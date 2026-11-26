#!/usr/bin/env python3
"""
make_qr.py -- Generate QR codes for certificate verification.

Reads certificate IDs from data.xlsx and produces both PNG and SVG
QR code images encoding verification URLs.

Usage:
    python make_qr.py --domain yourdomain.com
    python make_qr.py --input ../data.xlsx --output ../qr --domain buildwithai-abc.web.app
"""

import argparse
import sys
from pathlib import Path

import pandas as pd
import qrcode
from qrcode.image.svg import SvgPathImage


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate QR codes for certificate verification URLs."
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
        help="Output directory for QR code images. Defaults to ../qr/ relative to this script.",
    )
    parser.add_argument(
        "--domain",
        type=str,
        default="[YOUR-DOMAIN]",
        help="Domain name for verification URLs (e.g., buildwithai-abc.web.app).",
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
        output_path = script_dir.parent / "qr"
    else:
        output_path = Path(args.output).resolve()

    return input_path, output_path


def generate_png_qr(url, output_file):
    """
    Generate a PNG QR code image for the given URL.

    Uses error correction level H (highest, ~30% recovery) and a border
    of 4 modules (quiet zone).
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    # Resize to 300x300 pixels
    img = img.resize((300, 300))
    img.save(str(output_file))


def generate_svg_qr(url, output_file):
    """
    Generate an SVG QR code image for the given URL.

    Uses the SvgPathImage factory from the qrcode library for clean
    vector output. Error correction level H and border of 4 modules.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(image_factory=SvgPathImage)
    img.save(str(output_file))


def main():
    """Main entry point for QR code generation."""
    args = parse_args()
    input_path, output_dir = resolve_default_paths(args)
    domain = args.domain

    # ---- Verify input file exists ----
    if not input_path.is_file():
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    print(f"Reading data from: {input_path}")
    print(f"Output directory:  {output_dir}")
    print(f"Domain:            {domain}")
    print()

    # ---- Read the certificates sheet ----
    try:
        df = pd.read_excel(input_path, sheet_name="certificates", engine="openpyxl")
    except Exception as exc:
        print(f"ERROR: Failed to read certificates sheet: {exc}")
        sys.exit(1)

    if "certificate_id" not in df.columns:
        print("ERROR: 'certificate_id' column not found in certificates sheet.")
        sys.exit(1)

    # ---- Ensure output directory exists ----
    output_dir.mkdir(parents=True, exist_ok=True)

    # ---- Generate QR codes ----
    total = len(df)
    success_count = 0
    error_count = 0

    for idx, row in df.iterrows():
        cert_id = str(row["certificate_id"]).strip()

        if not cert_id or cert_id.lower() == "nan":
            print(f"  [SKIP] Row {idx + 2}: Empty certificate_id")
            error_count += 1
            continue

        verification_url = f"https://{domain}/verify/?id={cert_id}"

        png_file = output_dir / f"{cert_id}.png"
        svg_file = output_dir / f"{cert_id}.svg"

        try:
            generate_png_qr(verification_url, png_file)
            generate_svg_qr(verification_url, svg_file)
            success_count += 1
            print(f"  [{success_count}/{total}] Generated QR for: {cert_id}")
        except Exception as exc:
            error_count += 1
            print(f"  [ERROR] Row {idx + 2} ({cert_id}): {exc}")

    # ---- Summary ----
    print()
    print(f"QR code generation complete.")
    print(f"  Total certificates: {total}")
    print(f"  Successfully generated: {success_count} (PNG + SVG each)")
    print(f"  Errors/skipped: {error_count}")
    print(f"  Output directory: {output_dir}")


if __name__ == "__main__":
    main()
