import DbProvider from "./base";
import { App, Setting } from 'obsidian';
import { WebDb } from "./drive/api/handler";
import Plugin from "@/plugin";
import FileDB from "./drive/file/handler";
import { IndexedDB } from "./drive/Indexed/handler";

export class DbSingleton {
    private connects: DbProvider = null;
    private plugin: Plugin = null;

    public constructor(plugin: Plugin, drive: string,) {
        this.plugin = plugin;
        this.connect(drive);
    }

    public DB(): DbProvider {
        return this.drive;
    }

    public connect(drive: string) {
        if (this.drive !== null) {
            return;
        }

        this.drive = this.register(drive);
        this.drive.open();
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
    API = 'api',
    INDEXED = 'indexed',
    FILE = 'file',
}
