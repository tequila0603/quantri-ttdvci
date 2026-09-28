import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import { parseFinanceImport } from '../src/services/import-parser.js'
import { Kysely } from 'kysely'
import type { DB } from '../src/db/schema.js'

describe('Finance Import Parser', () => {
    
    // Mock the DB
    const mockDb = {
        selectFrom: (table: string) => ({
            select: () => ({
                execute: async () => {
                    if (table === 'core.enterprises') {
                        return [{ id: '1', tax_code: 'DN-001' }]
                    }
                    if (table === 'core.industrial_parks') {
                        return [{ id: '1', code: 'KCN_AN_PHU' }]
                    }
                    return []
                }
            }),
            where: () => ({
                where: () => ({
                    where: () => ({
                        where: () => ({
                            select: () => ({
                                executeTakeFirst: async () => null
                            })
                        }),
                        select: () => ({
                            executeTakeFirst: async () => null
                        })
                    }),
                    select: () => ({
                        executeTakeFirst: async () => null
                    })
                }),
                select: () => ({
                    executeTakeFirst: async () => null
                })
            })
        })
    } as unknown as Kysely<DB>

    test('parses annual_lease successfully', async () => {
        const raw = [
            {
                enterprise_code: 'DN-001',
                park_code: 'KCN_AN_PHU',
                reporting_year: 2026,
                lot_location: 'A1',
                land_area_m2: 5000,
                raw_land_lease_amount: 10000000,
                infrastructure_asset_lease_amount: 5000000,
                infrastructure_service_lease_amount: 2000000
            }
        ]
        
        const res = await parseFinanceImport(mockDb, 'annual_lease', raw)
        assert.strictEqual(res.totalRows, 1)
        assert.strictEqual(res.acceptedRows, 1)
        assert.strictEqual(res.rejectedRows, 0)
        assert.strictEqual(res.totalAmount, 17000000)
    })
    
    test('rejects annual_lease with missing required fields', async () => {
        const raw = [
            {
                enterprise_code: 'DN-001',
                // park_code missing
                reporting_year: 2026,
                lot_location: 'A1',
                land_area_m2: 5000,
                raw_land_lease_amount: 10000000,
                infrastructure_asset_lease_amount: 5000000,
                infrastructure_service_lease_amount: 2000000
            }
        ]
        
        const res = await parseFinanceImport(mockDb, 'annual_lease', raw)
        assert.strictEqual(res.totalRows, 1)
        assert.strictEqual(res.acceptedRows, 0)
        assert.strictEqual(res.rejectedRows, 1)
        assert.strictEqual(res.rows[0].errorCode, 'MISSING_REQUIRED')
        assert.strictEqual(res.rows[0].errorField, 'park_code')
    })
    
    test('parses invoice successfully', async () => {
        const raw = [
            {
                enterprise_code: 'DN-001',
                invoice_number: '001234',
                total_amount: 5000000
            }
        ]
        
        const res = await parseFinanceImport(mockDb, 'invoice', raw)
        assert.strictEqual(res.totalRows, 1)
        assert.strictEqual(res.acceptedRows, 1)
        assert.strictEqual(res.rejectedRows, 0)
        assert.strictEqual(res.totalAmount, 5000000)
    })
})
