import DbProvider from "./base";
import { WebDb } from "./drive/api/handler";
import Plugin from "@/plugin";
import FileDB from "./drive/file/handler";
import { IndexedDB } from "./drive/Indexed/handler";
import path from "path";

export class DbSingleton {
    private connects: Map<string, DbProvider> = new Map();
    private plugin: Plugin = null;
    private useConnect: DbProvider = null;
    private useConnectKey: string = null;

    public constructor(plugin: Plugin) {
        this.syncSetting(plugin)
    }

    public syncSetting(plugin: Plugin): DbSingleton {
        this.plugin = plugin;
        return this
    }

    public DB(): DbProvider | null {
        return this.useConnect;
    }

    public drive(drive: string): DbProvider {
        if (this.useConnect !== null) {
            this.useConnect.close();
            this.useConnect = null;
        }

        if (this.connects.has(drive)) {
            this.useConnect = this.connects.get(drive)
        } else {
            this.useConnect = this.register(drive);
        }

        this.useConnectKey = drive;
        this.useConnect.open();

        return this.useConnect;
    }

    // 销毁所有服务
    public destroyed() {
        this.connects.forEach(item => {
            item.close();
        })

        this.connects.clear();
    }

    public sync(plugin: Plugin) {
        this.syncSetting(plugin)
        this.reRegister(plugin.settings.db_type);
    }

    public reRegister(drive: string): DbProvider {
        if (this.connects.has(drive)) {
            this.connects.get(drive).close();
            this.connects.delete(drive);
        }

        return this.drive(drive);
    }

    private register(drive: string): DbProvider {
        switch (drive) {
            case DBDrive.API:
                return new WebDb(this.plugin.settings.port);
            case DBDrive.FILE:
                return new FileDB(this.plugin);
            case DBDrive.INDEXED:
                return new IndexedDB(this.plugin);
        }
    }
}

export enum DBDrive {
    API = 'webApi',
    INDEXED = 'indexed',
    FILE = 'file',
}
