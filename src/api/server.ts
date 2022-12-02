import http from "http";
import url from "url";
import LanguageLearner from "@/plugin";
import { dict } from "@/constant";

const ALLOWED_HEADERS =
    'Access-Control-Allow-Headers, Origin, Authorization,Accept,x-client-id, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, hypothesis-client-version';

const mimeType = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.eot': 'application/vnd.ms-fontobject',
    '.ttf': 'application/x-font-ttf'
};

type RequestType = "LOAD" | "STORE" | "TAG" | "ECHO" | "OTHER";


export default class Server {
    plugin: LanguageLearner;
    _server: http.Server;
    port: number;

    constructor(plugin: LanguageLearner, port: number) {
        this.plugin = plugin;
        this.port = port;
    }

    async _startListen(port: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._server.listen(port, () => {
                resolve();
            });
        });
    }

    async start() {
        const server = http.createServer();
        this._server = server;
        server.on("request", this.process);
        await this._startListen(this.port);
        console.log(`${dict["NAME"]}: Server established on port ${this.port}`);
    }

    async _closeServer() {
        return new Promise<void>((resolve, reject) => {
            this._server.close(() => {
                resolve();
            });
        });
    }

    async close() {
        await this._closeServer();
        this._server = null;
        console.log(`${dict["NAME"]}: Server on port ${this.port} has closed`);
    }

    process = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        if (req.method === "OPTIONS") {
            res.end();
            return;
        }

        let type = this.parseUrl(req.url);
        switch (type) {
            case "ECHO": {
                // console.log("hello from chrome")
                res.setHeader("Keep-Alive", "timeout=0");
                res.statusCode = 200;
                res.end("hi");
                break;
            }
            case "LOAD": {
                let data = await this.parseData(req, res);
                let expr = await this.plugin.db.getExpression(data);
                res.setHeader('Content-type', mimeType[".json"]);
                res.statusCode = 200;
                res.end(JSON.stringify(expr));
                break;
            }
            case "STORE": {
                let data = await this.parseData(req, res);
                await this.plugin.db.postExpression(data);
                res.statusCode = 200;
                res.end();
                if (this.plugin.settings.auto_refresh_db) {
                    this.plugin.refreshTextDB();
                }
                break;
            }
            case "TAG": {
                let tags = await this.plugin.db.getTags();
                res.setHeader('Content-type', mimeType[".json"]);
                res.statusCode = 200;
                res.end(JSON.stringify(tags));
                break;
            }
            default: {
                res.statusCode = 400;
                res.end("Bad Request");
            }
        }
    };

    async parseData(req: http.IncomingMessage, res: http.ServerResponse): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let _data: number[] = [];
            req.on("data", chunk => {
                _data.push(...chunk);
            });
            req.on("end", async () => {
                let rawtext = new TextDecoder().decode(new Uint8Array(_data));
                if (!rawtext) rawtext = '"hello"';
                let data = JSON.parse(rawtext);
                resolve(data);
            });
        });

    }

    parseUrl(_url: string): RequestType {
        let urlObj = url.parse(_url, true);
        if (urlObj.path === "/word") return "LOAD";
        if (urlObj.path === "/update") return "STORE";
        if (urlObj.path === "/tags") return "TAG";
        if (urlObj.path === "/echo") return "ECHO";

        return "OTHER";
    }
}


