import re

with open("routes/field-report-routes.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace static calls with instance calls
content = content.replace("await FieldReportRepository.", "await repo.")

# Find the start of the quick-ingest route to insert the repository instantiation
repo_init = r'''  app.post('/quick-ingest', async (request, reply) => {
    const repo = new FieldReportRepository(options.database);'''
content = content.replace("  app.post('/quick-ingest', async (request, reply) => {", repo_init)

with open("routes/field-report-routes.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated field-report-routes.ts")
