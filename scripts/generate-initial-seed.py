"""Generate a safe, deterministic PostgreSQL seed from the supplied workbooks."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

import openpyxl
from python_calamine import CalamineWorkbook


CATEGORIES = (
    ("RAW_LAND_LEASE", 4, "Tiền thuê ĐNT"),
    ("INFRASTRUCTURE_ASSET_LEASE", 5, "Tiền KCHT"),
    ("INFRASTRUCTURE_SERVICE_LEASE", 6, "Tiền DVHT"),
)


def clean_text(value) -> str | None:
    if value is None:
        return None
    value = str(value).replace("\xa0", " ").replace("\r", " ").replace("\n", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value or None


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    return " ".join(value.casefold().split())


def sql_text(value) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def sql_json(value) -> str:
    return sql_text(json.dumps(value, ensure_ascii=False, default=str)) + "::jsonb"


def money(value) -> str:
    if value in (None, ""):
        return "0.00"
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid money value: {value!r}") from exc
    return format(amount, "f")


def area(value) -> str:
    if value in (None, ""):
        return "0.0000"
    amount = Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return format(amount, "f")


def parse_date(value) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    for pattern in (r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$", r"^(\d{4})-(\d{1,2})-(\d{1,2})$"):
        match = re.match(pattern, text)
        if not match:
            continue
        parts = [int(part) for part in match.groups()]
        if len(str(parts[0])) == 4:
            year, month, day = parts
        else:
            day, month, year = parts
        return datetime(year, month, day).date().isoformat()
    return None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_employees(path: Path):
    workbook = CalamineWorkbook.from_path(str(path))
    rows = []
    for sheet_name in workbook.sheet_names:
        if not sheet_name.startswith("DS VC-NLĐ TT"):
            continue
        sheet_rows = workbook.get_sheet_by_name(sheet_name).to_python()
        section = None
        subgroup = None
        for row_number, row in enumerate(sheet_rows, start=1):
            first = row[0] if row else None
            second = clean_text(row[1] if len(row) > 1 else None)
            if isinstance(first, str) and re.fullmatch(r"(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.?", first.strip()):
                section = second
                subgroup = None
                continue
            if first == "-" and second:
                subgroup = second
                continue
            if not isinstance(first, (int, float)) or not second:
                continue
            unit_name = section or "Trung tâm Dịch vụ công ích"
            if subgroup:
                unit_name = f"{unit_name} / {subgroup}"
            rows.append({
                "employee_code": f"TT-{int(first):03d}",
                "full_name": second,
                "birth_date": parse_date(row[2] if len(row) > 2 else None),
                "unit_name": unit_name,
                "professional_qualification": clean_text(row[3] if len(row) > 3 else None),
                "political_theory": clean_text(row[4] if len(row) > 4 else None),
                "state_management": clean_text(row[5] if len(row) > 5 else None),
                "foreign_language": clean_text(row[6] if len(row) > 6 else None),
                "informatics": clean_text(row[7] if len(row) > 7 else None),
                "work_position": clean_text(row[8] if len(row) > 8 else None),
                "party_position": clean_text(row[9] if len(row) > 9 else None),
                "employment_type": clean_text(row[10] if len(row) > 10 else None),
                "source_file": path.name,
                "source_sheet": sheet_name,
                "source_row": row_number,
                "source_payload": row,
            })
    if len(rows) != 39:
        raise ValueError(f"Expected 39 Trung tâm employees, found {len(rows)}")
    return rows


def park_code(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Z0-9]+", "_", ascii_name.upper()).strip("_")


def read_land_data(path: Path):
    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = []
    parks = {}
    for sheet in workbook.worksheets:
        match = re.search(r"(20\d{2})$", sheet.title)
        if not match:
            continue
        reporting_year = int(match.group(1))
        current_park = None
        for row in sheet.iter_rows(min_row=1, max_col=9):
            first = row[0].value
            second = clean_text(row[1].value)
            if second and second.startswith("KCN "):
                current_park = second
                parks.setdefault(current_park, park_code(current_park))
                continue
            if not isinstance(first, (int, float)) or not clean_text(row[2].value) or not current_park:
                continue
            enterprise_name = clean_text(row[1].value)
            if not enterprise_name:
                continue
            rows.append({
                "reporting_year": reporting_year,
                "enterprise_name": enterprise_name,
                "enterprise_key": normalize(enterprise_name),
                "park_name": current_park,
                "park_code": parks[current_park],
                "lot_location": clean_text(row[2].value),
                "land_area_m2": area(row[3].value),
                "amounts": {code: money(row[column].value) for code, column, _ in CATEGORIES},
                "source_total_amount": money(row[7].value),
                "lease_status": clean_text(row[8].value),
                "source_file": path.name,
                "source_sheet": sheet.title,
                "source_row": row[0].row,
                "source_payload": [cell.value for cell in row],
            })
    if len(rows) != 525:
        raise ValueError(f"Expected 525 enterprise-year rows, found {len(rows)}")
    return rows, parks


def generate(employee_path: Path, land_path: Path, output_path: Path):
    employees = read_employees(employee_path)
    land_rows, parks = read_land_data(land_path)
    employee_sha = sha256(employee_path)
    land_sha = sha256(land_path)
    lines = [
        "BEGIN;",
        "INSERT INTO ingest.import_batches (source_file, source_sha256, import_kind, status) VALUES",
        f"  ({sql_text(employee_path.name)}, {sql_text(employee_sha)}, 'WORKFORCE', 'COMMITTED'),",
        f"  ({sql_text(land_path.name)}, {sql_text(land_sha)}, 'LAND_FINANCE', 'COMMITTED')",
        "ON CONFLICT (source_file, source_sha256) DO NOTHING;",
    ]
    for name, code in sorted(parks.items()):
        lines.append(f"INSERT INTO core.industrial_parks (code, name) VALUES ({sql_text(code)}, {sql_text(name)}) ON CONFLICT DO NOTHING;")
    for employee in employees:
        unit = employee["unit_name"]
        lines.append(f"INSERT INTO core.organizational_units (name) VALUES ({sql_text(unit)}) ON CONFLICT (name) DO NOTHING;")
    for row in land_rows:
        lines.append(
            "INSERT INTO core.enterprises (legal_name, normalized_name) VALUES "
            f"({sql_text(row['enterprise_name'])}, {sql_text(row['enterprise_key'])}) "
            "ON CONFLICT (normalized_name) DO NOTHING;"
        )
    for employee in employees:
        columns = [
            "employee_code", "full_name", "birth_date", "organizational_unit_id",
            "professional_qualification", "political_theory", "state_management",
            "foreign_language", "informatics", "work_position", "party_position",
            "employment_type", "source_file", "source_sheet", "source_row", "source_payload",
        ]
        values = [
            sql_text(employee["employee_code"]), sql_text(employee["full_name"]), sql_text(employee["birth_date"]),
            f"(SELECT id FROM core.organizational_units WHERE name = {sql_text(employee['unit_name'])})",
            sql_text(employee["professional_qualification"]), sql_text(employee["political_theory"]),
            sql_text(employee["state_management"]), sql_text(employee["foreign_language"]), sql_text(employee["informatics"]),
            sql_text(employee["work_position"]), sql_text(employee["party_position"]), sql_text(employee["employment_type"]),
            sql_text(employee["source_file"]), sql_text(employee["source_sheet"]), str(employee["source_row"]), sql_json(employee["source_payload"]),
        ]
        lines.append(
            f"INSERT INTO workforce.employees ({', '.join(columns)}) VALUES ({', '.join(values)}) "
            "ON CONFLICT (employee_code) DO NOTHING;"
        )
    for row in land_rows:
        park_id = f"(SELECT id FROM core.industrial_parks WHERE code = {sql_text(row['park_code'])})"
        enterprise_id = f"(SELECT id FROM core.enterprises WHERE normalized_name = {sql_text(row['enterprise_key'])})"
        batch_id = f"(SELECT id FROM ingest.import_batches WHERE source_file = {sql_text(row['source_file'])} AND source_sha256 = {sql_text(land_sha)})"
        snapshot_values = [
            enterprise_id, park_id, str(row["reporting_year"]), sql_text(row["lot_location"]), row["land_area_m2"],
            sql_text(row["lease_status"]), row["source_total_amount"], sql_text(row["source_file"]),
            sql_text(row["source_sheet"]), str(row["source_row"]), sql_json(row["source_payload"]),
        ]
        lines.append(
            "INSERT INTO finance.annual_lease_snapshots "
            "(enterprise_id, industrial_park_id, reporting_year, lot_location, land_area_m2, lease_status, source_total_amount, source_file, source_sheet, source_row, source_payload) "
            f"VALUES ({', '.join(snapshot_values)}) ON CONFLICT (enterprise_id, industrial_park_id, reporting_year, lot_location) DO NOTHING;"
        )
        snapshot_id = (
            "(SELECT id FROM finance.annual_lease_snapshots WHERE enterprise_id = "
            f"{enterprise_id} AND industrial_park_id = {park_id} AND reporting_year = {row['reporting_year']} "
            f"AND lot_location = {sql_text(row['lot_location'])})"
        )
        for category_code, _, _ in CATEGORIES:
            lines.append(
                "INSERT INTO finance.annual_charges (snapshot_id, category_code, amount_due) "
                f"VALUES ({snapshot_id}, {sql_text(category_code)}, {row['amounts'][category_code]}) ON CONFLICT DO NOTHING;"
            )
        lines.append(
            "INSERT INTO ingest.import_rows (batch_id, source_sheet, source_row, status, raw_payload) "
            f"VALUES ({batch_id}, {sql_text(row['source_sheet'])}, {row['source_row']}, 'VALID', {sql_json(row['source_payload'])}) "
            "ON CONFLICT DO NOTHING;"
        )
    for employee in employees:
        batch_id = f"(SELECT id FROM ingest.import_batches WHERE source_file = {sql_text(employee['source_file'])} AND source_sha256 = {sql_text(employee_sha)})"
        lines.append(
            "INSERT INTO ingest.import_rows (batch_id, source_sheet, source_row, status, raw_payload) "
            f"VALUES ({batch_id}, {sql_text(employee['source_sheet'])}, {employee['source_row']}, 'VALID', {sql_json(employee['source_payload'])}) "
            "ON CONFLICT DO NOTHING;"
        )
    lines.append("COMMIT;")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"employees": len(employees), "enterprise_year_rows": len(land_rows), "charge_rows": len(land_rows) * len(CATEGORIES), "industrial_parks": len(parks), "output": str(output_path)}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--employees", type=Path, required=True)
    parser.add_argument("--land", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    generate(args.employees, args.land, args.output)


if __name__ == "__main__":
    main()
