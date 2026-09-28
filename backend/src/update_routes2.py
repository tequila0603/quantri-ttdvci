import re

with open("routes/field-report-routes.ts", "r", encoding="utf-8") as f:
    content = f.read()

repo_init = r'''('/quick-ingest', async (request, reply) => {
    const repo = new FieldReportRepository(options.database);'''
content = content.replace("('/quick-ingest', async (request, reply) => {", repo_init)

with open("routes/field-report-routes.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated field-report-routes.ts")
