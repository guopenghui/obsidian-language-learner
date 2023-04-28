import {Database} from "sqlite3";
import * as path from "path";
import * as fs from "fs";

export class Structure {
    public createTables (db: Database) {
        return new Promise((resolve, reject) => {
            const filePath = path.join(__dirname, '/sqlite.sql')
            fs.readFile(filePath, 'utf-8', (err, sql) => {
                if (err !== null) {
                    console.log('Readfile err: ', err)
                    reject(err)
                } else {
                    db.exec(sql, (err) => {
                        if (err !== null) {
                            reject(err)
                        } else {
                            resolve(null)
                        }
                    })
                }
            })
        })
    }
}
