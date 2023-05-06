import {ElectronStorage} from "tedb-electron-storage";
import {existsSync, mkdirSync} from 'graceful-fs';
const path = require('path');


export class Storage extends ElectronStorage {
    constructor(db: string, collection: string, dir: string) {
        // todo 由于原作者没有提供可以指定目录，需要继承后进行覆盖
        super("", "");

        this.collectionPath = path.join(dir, 'db', collection);
        this.allKeys = [];
        if (!existsSync(`${path.join(dir, 'db')}`)) {
            mkdirSync(`${path.join(dir, 'db')}`);
        }
        if (!existsSync(this.collectionPath)) {
            mkdirSync(this.collectionPath);
        }
        // -------------------------------------------------------------------
        // This is a section that can be updated to change operation of the db
        // without affecting the operation of the db and the current file
        // current location of the readable items.
        // -------------------------------------------------------------------
        this.version = '`v0.0.1';
        // make sure that this version directory exists
        if (!existsSync(path.join(this.collectionPath, this.version))) {
            mkdirSync(path.join(this.collectionPath, this.version));
        }
        // make sure this versions states directory exists
        if (!existsSync(path.join(this.collectionPath, this.version, 'states'))) {
            mkdirSync(path.join(this.collectionPath, this.version, 'states'));
        }
        // -------------------------------------------------------------------
    }
}
