#!/usr/bin/env python3
"""
build_data.py -- Data pipeline for the Build with AI event website.

Reads data.xlsx and produces static JSON files for certificates,
leaderboard, and notices. Certificate records are individually hashed
and stored as separate JSON files to prevent enumeration.

Usage:
    python build_data.py
    python build_data.py --input ../data.xlsx --output ../data
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Read data.xlsx and produce static JSON files for the event website."
    )
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Path to data.xlsx. Defaults to ../data.xlsx relative to this script.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for JSON files. Defaults to ../data/ relative to this script.",
    )
    return parser.parse_args()


def resolve_default_paths(args):
    """Resolve default input/output paths relative to the script location."""
    script_dir = Path(__file__).resolve().parent

    if args.input is None:
        input_path = script_dir.parent / "data.xlsx"
    else:
        input_path = Path(args.input).resolve()

    if args.output is None:
        output_path = script_dir.parent / "data"
    else:
        output_path = Path(args.output).resolve()

    return input_path, output_path


def validate_certificates(df):
    """
    Validate the certificates DataFrame.

    Returns a list of error messages. An empty list means validation passed.
    """
    errors = []

    # ---- Check for duplicate certificate_id values ----
    if "certificate_id" not in df.columns:
        errors.append("ERROR: 'certificate_id' column is missing from the certificates sheet.")
        return errors

    cert_ids = df["certificate_id"].astype(str).str.strip().str.upper()
    duplicated_mask = cert_ids.duplicated(keep=False)
    if duplicated_mask.any():
        duplicate_values = sorted(cert_ids[duplicated_mask].unique().tolist())
        errors.append(
            f"ERROR: Duplicate certificate_id values found: {', '.join(duplicate_values)}"
        )

    # ---- Check for empty name fields ----
    if "name" in df.columns:
        empty_name_mask = df["name"].isna() | (df["name"].astype(str).str.strip() == "")
        if empty_name_mask.any():
            # Row numbers are 1-indexed for user display, plus 2 for header + 0-index offset
            row_numbers = [str(i + 2) for i in df.index[empty_name_mask].tolist()]
            errors.append(
                f"ERROR: Empty name fields found at Excel row(s): {', '.join(row_numbers)}"
            )
    else:
        errors.append("ERROR: 'name' column is missing from the certificates sheet.")

    # ---- Check for invalid dates ----
    if "issue_date" in df.columns:
        invalid_date_rows = []
        for idx, value in df["issue_date"].items():
            if pd.isna(value):
                invalid_date_rows.append(str(idx + 2))
                continue
            if isinstance(value, datetime):
                continue
            try:
                pd.to_datetime(value)
            except (ValueError, TypeError):
                invalid_date_rows.append(str(idx + 2))
        if invalid_date_rows:
            errors.append(
                f"ERROR: Invalid issue_date values at Excel row(s): {', '.join(invalid_date_rows)}"
            )
    else:
        errors.append("ERROR: 'issue_date' column is missing from the certificates sheet.")

    # ---- Check status must be "valid" or "revoked" ----
    if "status" in df.columns:
        valid_statuses = {"valid", "revoked"}
        invalid_status_rows = []
        for idx, value in df["status"].items():
            if pd.isna(value):
                invalid_status_rows.append(str(idx + 2))
                continue
            if str(value).strip().lower() not in valid_statuses:
                invalid_status_rows.append(str(idx + 2))
        if invalid_status_rows:
            errors.append(
                f"ERROR: Invalid status values at Excel row(s): {', '.join(invalid_status_rows)}. "
                f"Status must be 'valid' or 'revoked'."
            )
    else:
        errors.append("ERROR: 'status' column is missing from the certificates sheet.")

    return errors


def process_certificates(df, output_dir):
    """
    Process validated certificates and write individual hashed JSON files.

    For each certificate row:
      - Normalize certificate_id: strip whitespace, uppercase
      - Compute SHA-256 of the normalized certificate_id
      - Write a JSON file containing only the allowed public fields

    Returns the number of certificates processed.
    """
    certs_dir = output_dir / "certs"
    certs_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for _, row in df.iterrows():
        # Normalize certificate_id
        cert_id_normalized = str(row["certificate_id"]).strip().upper()

        # Compute SHA-256 hash
        sha256_hex = hashlib.sha256(cert_id_normalized.encode("utf-8")).hexdigest()

        # Parse issue_date to ISO format string
        issue_date_value = row["issue_date"]
        if isinstance(issue_date_value, datetime):
            issue_date_iso = issue_date_value.date().isoformat()
        else:
            parsed_date = pd.to_datetime(issue_date_value)
            issue_date_iso = parsed_date.date().isoformat()

        # Build the certificate record with ONLY allowed fields
        cert_record = {
            "name": str(row["name"]).strip(),
            "college": str(row.get("college", "")).strip(),
            "department": str(row.get("department", "")).strip(),
            "year": str(row.get("year", "")).strip(),
            "role": str(row.get("role", "")).strip(),
            "event": str(row.get("event", "")).strip(),
            "issue_date": issue_date_iso,
            "status": str(row["status"]).strip().lower(),
        }

        # Write individual JSON file
        cert_file = certs_dir / f"{sha256_hex}.json"
        with open(cert_file, "w", encoding="utf-8") as f:
            json.dump(cert_record, f, indent=2, ensure_ascii=False)

        count += 1

    return count


def validate_and_process_notices(df):
    """
    Validate and process the notices DataFrame.

    Returns (processed_records_list, error_list).
    """
    errors = []

    # ---- Validate category ----
    valid_categories = {"Notice", "Event", "Update"}
    if "category" in df.columns:
        invalid_cat_rows = []
        for idx, value in df["category"].items():
            if pd.isna(value) or str(value).strip() not in valid_categories:
                invalid_cat_rows.append(str(idx + 2))
        if invalid_cat_rows:
            errors.append(
                f"ERROR: Invalid category values at Excel row(s): {', '.join(invalid_cat_rows)}. "
                f"Category must be one of: Notice, Event, Update."
            )
    else:
        errors.append("ERROR: 'category' column is missing from the notices sheet.")

    # ---- Validate pinned ----
    valid_pinned = {"yes", "no"}
    if "pinned" in df.columns:
        invalid_pinned_rows = []
        for idx, value in df["pinned"].items():
            if pd.isna(value) or str(value).strip().lower() not in valid_pinned:
                invalid_pinned_rows.append(str(idx + 2))
        if invalid_pinned_rows:
            errors.append(
                f"ERROR: Invalid pinned values at Excel row(s): {', '.join(invalid_pinned_rows)}. "
                f"Pinned must be 'yes' or 'no'."
            )
    else:
        errors.append("ERROR: 'pinned' column is missing from the notices sheet.")

    if errors:
        return [], errors

    # ---- Process notices ----
    records = []
    for _, row in df.iterrows():
        date_value = row.get("date", "")
        if isinstance(date_value, datetime):
            date_str = date_value.date().isoformat()
        elif pd.notna(date_value):
            try:
                date_str = pd.to_datetime(date_value).date().isoformat()
            except (ValueError, TypeError):
                date_str = str(date_value).strip()
        else:
            date_str = ""

        pinned_bool = str(row["pinned"]).strip().lower() == "yes"

        record = {
            "date": date_str,
            "title": str(row.get("title", "")).strip(),
            "body": str(row.get("body", "")).strip(),
            "category": str(row.get("category", "")).strip(),
            "link": str(row.get("link", "")).strip() if pd.notna(row.get("link", "")) else "",
            "pinned": pinned_bool,
        }
        records.append(record)

    # Sort: pinned=True first, then by date descending
    records.sort(key=lambda r: (not r["pinned"], r["date"]), reverse=False)
    # Pinned first (not True == False sorts before not False == True)
    # Within each group, sort by date descending
    pinned_records = [r for r in records if r["pinned"]]
    unpinned_records = [r for r in records if not r["pinned"]]
    pinned_records.sort(key=lambda r: r["date"], reverse=True)
    unpinned_records.sort(key=lambda r: r["date"], reverse=True)
    sorted_records = pinned_records + unpinned_records

    return sorted_records, []


def process_leaderboard(df):
    """
    Process the leaderboard DataFrame.

    Sort by rank ascending and return a list of record dicts.
    """
    # Ensure rank is numeric for proper sorting
    df = df.copy()
    df["rank"] = pd.to_numeric(df["rank"], errors="coerce")
    df = df.sort_values("rank", ascending=True)

    records = []
    for _, row in df.iterrows():
        record = {
            "rank": int(row["rank"]) if pd.notna(row["rank"]) else None,
            "name_or_team": str(row.get("name_or_team", "")).strip(),
            "project_title": str(row.get("project_title", "")).strip(),
            "category": str(row.get("category", "")).strip(),
            "prize": str(row.get("prize", "")).strip(),
            "points": int(row["points"]) if pd.notna(row.get("points", None)) else 0,
        }
        records.append(record)

    return records


def main():
    """Main entry point for the data build pipeline."""
    args = parse_args()
    input_path, output_dir = resolve_default_paths(args)

    # ---- Verify input file exists ----
    if not input_path.is_file():
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    print(f"Reading data from: {input_path}")
    print(f"Output directory:  {output_dir}")

    # ---- Read all sheets ----
    try:
        xl = pd.ExcelFile(input_path, engine="openpyxl")
    except Exception as exc:
        print(f"ERROR: Failed to open Excel file: {exc}")
        sys.exit(1)

    required_sheets = ["certificates", "leaderboard", "notices"]
    for sheet_name in required_sheets:
        if sheet_name not in xl.sheet_names:
            print(f"ERROR: Required sheet '{sheet_name}' not found in {input_path}")
            print(f"Available sheets: {', '.join(xl.sheet_names)}")
            sys.exit(1)

    df_certs = pd.read_excel(xl, sheet_name="certificates")
    df_leader = pd.read_excel(xl, sheet_name="leaderboard")
    df_notices = pd.read_excel(xl, sheet_name="notices")

    # ---- Collect all validation errors before exiting ----
    all_errors = []

    # Validate certificates
    cert_errors = validate_certificates(df_certs)
    all_errors.extend(cert_errors)

    # Validate notices (validation only at this stage)
    notice_records, notice_errors = validate_and_process_notices(df_notices)
    all_errors.extend(notice_errors)

    # If any validation errors, print all and exit
    if all_errors:
        print("\n--- VALIDATION ERRORS ---")
        for error in all_errors:
            print(error)
        print(f"\nTotal errors: {len(all_errors)}")
        sys.exit(1)

    # ---- Ensure output directory exists ----
    output_dir.mkdir(parents=True, exist_ok=True)

    # ---- Process certificates ----
    cert_count = process_certificates(df_certs, output_dir)

    # ---- Process leaderboard ----
    leaderboard_records = process_leaderboard(df_leader)
    leaderboard_file = output_dir / "leaderboard.json"
    with open(leaderboard_file, "w", encoding="utf-8") as f:
        json.dump(leaderboard_records, f, indent=2, ensure_ascii=False)

    # ---- Write notices ----
    notices_file = output_dir / "notices.json"
    with open(notices_file, "w", encoding="utf-8") as f:
        json.dump(notice_records, f, indent=2, ensure_ascii=False)

    # ---- Summary ----
    print(
        f"\nProcessed {cert_count} certificates, "
        f"{len(leaderboard_records)} leaderboard entries, "
        f"{len(notice_records)} notices"
    )
    print("Done.")


if __name__ == "__main__":
    main()
