"""
import_participants.py
----------------------
Imports participant records from a Google Form Excel export
(e.g. ABCparticipants.xlsx, sheet 'Form Responses 1') into data.xlsx's
'certificates' sheet, stripping all PII (Email Address, Whatsapp No., Gmail Id)
and preserving the 'leaderboard' and 'notices' sheets in data.xlsx.
"""

import argparse
from pathlib import Path
import pandas as pd


def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    parser = argparse.ArgumentParser(
        description="Import Google Form participant responses into data.xlsx."
    )
    parser.add_argument(
        "--source",
        default=str(project_root / "ABCparticipants.xlsx"),
        help="Path to the Google Form Excel export (default: ../ABCparticipants.xlsx)",
    )
    parser.add_argument(
        "--target",
        default=str(project_root / "data.xlsx"),
        help="Path to data.xlsx (default: ../data.xlsx)",
    )
    parser.add_argument(
        "--college",
        default="GCETTS",
        help="Default college name (default: GCETTS)",
    )
    parser.add_argument(
        "--event",
        default="Build with AI: ABC",
        help="Event name (default: Build with AI: ABC)",
    )
    parser.add_argument(
        "--issue-date",
        default="2026-11-28",
        help="Issue date YYYY-MM-DD (default: 2026-11-28)",
    )
    args = parser.parse_args()

    df = pd.read_excel(args.source, sheet_name="Form Responses 1")

    certs_df = pd.DataFrame({
        "certificate_id": df["Certificate Number"].astype(str).str.strip().str.upper(),
        "name": df["Name"].astype(str).str.strip(),
        "college": args.college,
        "department": df["Stream"].astype(str).str.strip(),
        "year": df["Year"].astype(str).str.strip(),
        "role": "Participant",
        "event": args.event,
        "issue_date": args.issue_date,
        "status": "valid",
    })

    target_path = Path(args.target)
    existing_sheets = {}
    if target_path.exists():
        xl = pd.ExcelFile(target_path, engine="openpyxl")
        for sheet in xl.sheet_names:
            if sheet != "certificates":
                existing_sheets[sheet] = pd.read_excel(xl, sheet_name=sheet)

    with pd.ExcelWriter(target_path, engine="openpyxl") as writer:
        certs_df.to_excel(writer, sheet_name="certificates", index=False)
        for sheet, sheet_df in existing_sheets.items():
            sheet_df.to_excel(writer, sheet_name=sheet, index=False)

    print(f"Imported {len(certs_df)} participants into {target_path} (certificates sheet).")


if __name__ == "__main__":
    main()
