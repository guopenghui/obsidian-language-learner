import Plugin from "@/plugin";
import StorageDrive from "./drive";
// import { ApiStorageDrive } from './drive/api/handler';
import { IndexedStorageDrive } from './drive/Indexed/handler';
import {Sqlite3StorageDrive} from "@/storage/drive/sqlite3/handle";

export class StorageProvider {

    private plugin: Plugin = null;
    private useConnect: StorageDrive = null;

    public constructor(plugin: Plugin) {
        this.syncSetting(plugin)
    }

    public syncSetting(plugin: Plugin): StorageProvider {
        this.plugin = plugin;
        return this
    }

    public DB(): StorageDrive | null {
        return this.useConnect;
    }

    public async drive(drive: string): Promise<StorageDrive> {
        this.destroyed();

        this.useConnect = this.register(drive);

        console.log(this.useConnect, drive, 'this.useConnect')

        await this.useConnect.open();

        return this.useConnect;
    }

    // 销毁所有服务
    public destroyed() {
        if (this.useConnect) {
            this.useConnect.close();
            this.useConnect = null;
        }
    }

    public sync(plugin: Plugin) {
        this.syncSetting(plugin)
        this.reRegister(plugin.settings.storage.storage_type);
    }

    public async reRegister(drive: string): Promise<StorageDrive> {
        return await this.drive(drive);
    }

    private register(drive: string): StorageDrive {
        switch (drive) {
            // case StorageProviderDriveType.API:
                // return new ApiStorageDrive(
                //     this.plugin.settings.storage.drive["api"]["host"],
                //     this.plugin.settings.storage.drive["api"]["port"],
                //     this.plugin.settings.storage.drive["api"]["use_https"],
                //     this.plugin.settings.storage.drive["api"]["api_key"],
                // );
            case StorageProviderDriveType.INDEXED:
                return new IndexedStorageDrive(this.plugin);
            case StorageProviderDriveType.SQLITE:
                return new Sqlite3StorageDrive(this.plugin);
        }
    }
}

export enum StorageProviderDriveType {
    API = 'api',
    INDEXED = 'indexed',
    SQLITE = 'sqlite',
}
