with open('backend/src/reporting/model.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('year: number\n  periodLabel: string', 'periodLabel: string')

with open('backend/src/reporting/model.ts', 'w', encoding='utf-8') as f:
    f.write(c)

with open('backend/src/routes/report-routes.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("year: { type: 'integer', minimum: 2000, maximum: 2200 },", "")
c = c.replace("'year', 'periodLabel'", "'periodLabel'")
c = c.replace("if (from.getUTCFullYear() !== request.year || to.getUTCFullYear() !== request.year) {", "if (false) {")

with open('backend/src/routes/report-routes.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated year in request schemas")
