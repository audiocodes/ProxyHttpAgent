import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as https from 'https';
import { Server as HttpsServer } from 'https';
import * as http from 'http';
import { Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { ProxyServer } from './proxy';
import * as fs from 'fs';
import { getProxyHttpAgent } from '../src/index';
import * as url from 'url';
import fetch from 'node-fetch';

// util.inspect.defaultOptions.depth = null; //enable full object reporting in console.log

// jest.setTimeout(30000);

let localApiServer: HttpServer;
let localApiServerPort: number;

let localApiHttpsServer: HttpsServer;
let localApiHttpsServerPort: number;

let proxy: ProxyServer;
let proxyPort: number = 8123;


beforeAll(async () => {
    // _____________ setup the local api http server
    localApiServer = http.createServer();

    const httpServerReady = new Promise<void>((resolve) => {
        localApiServer.listen(() => {
            localApiServerPort = (localApiServer.address() as AddressInfo).port;
            console.log('localApiServerPort')
            console.log(localApiServerPort)
            resolve();
        });
    });

    localApiServer.on('data', (data: any) => {
        console.log('on data ::::')
        console.log(data.toString())
    });

    localApiServer.on('connection', (socket: any) => {
        socket.on('data', (data: any) => {
            console.log('on connection ::::')
            console.log(data.toString())
        })
    });

    // ____________ setup local api HTTPS server
    const options = {
        key: fs.readFileSync(`${__dirname}/server.key`),
        cert: fs.readFileSync(`${__dirname}/server.cert`)
    };
    localApiHttpsServer = https.createServer(options);

    const httpsServerReady = new Promise<void>((resolve) => {
        localApiHttpsServer.listen(() => {
            localApiHttpsServerPort = (localApiHttpsServer.address() as AddressInfo).port;
            console.log('localApiHttpsServerPort')
            console.log(localApiHttpsServerPort)
            resolve();
        });
    });

    // ____________ setup proxy
    proxy = new ProxyServer({
        port: proxyPort
    });

    const proxyReady = proxy.awaitStartedListening().catch(() => { });

    await Promise.all([httpServerReady, httpsServerReady, proxyReady]);
    console.log('DONE DONE DONE DONE');
});

// exit after test finish and release resources

afterAll(() => {
    setTimeout(() => {
        process.exit(0);
    }, 100);
});


// ______________ starting testing

describe('API checks', () => {
    test('Proxy option obligatory', () => {
        try {
            let agent = getProxyHttpAgent({} as any);
            expect.fail('No error thrown');
        } catch (err) {
            expect((err as Error).message).toBe('Proxy not provided');
        }
    });

    test('End server protocol Default to https', () => {
        let proxyUrl =
            process.env.HTTP_PROXY ||
            process.env.http_proxy ||
            `http://localhost:${proxyPort}`;

        let agent = getProxyHttpAgent({
            proxy: proxyUrl
        });

        // @ts-ignore
        expect(agent.test_endServerProtocol).toBe('https:');
    });
});

interface Res {
    host: string;
}

// _______ http local test server
describe('Node fetch', () => {
    describe('http local test server', () => {
        test('Test if it works with http (consuming a local server api)', async () => {
            console.log('test ::::>')
            localApiServer.once('request', function (req, res) {
                console.log('once hola !!!!!')
                res.end(JSON.stringify(req.headers));
            });

            let proxyUrl =
                process.env.HTTP_PROXY ||
                process.env.http_proxy ||
                `http://localhost:${proxyPort}`;

            let agent = getProxyHttpAgent({
                proxy: proxyUrl,
                endServerProtocol: 'http:'
            });
            const opts: any = url.parse(`http://localhost:${localApiServerPort}`);

            opts.agent = agent;

            await new Promise<void>((resolve, reject) => {
                let req = http.get(opts, function (res) {
                    let data: any = '';
                    res.setEncoding('utf8');
                    res.on('data', function (b) {
                        data += b;
                        console.log('::::::::::::::::::::::::::::::::::::://///>')
                        console.log('data :::')
                        console.log(data)
                    });
                    res.on('end', function () {
                        console.log('RESPONSE END ::::::::::::::://>')
                        data = JSON.parse(data);
                        expect(`localhost:${localApiServerPort}`).toEqual(data.host);
                        resolve();
                    });
                });
                req.once('error', reject);
            });
        });

        test('Test if it works with node fetch (consuming a local server api)', async () => {
            localApiServer.once('request', function (req, res) {
                res.end(JSON.stringify(req.headers));
            });

            let proxyUrl =
                process.env.HTTP_PROXY ||
                process.env.http_proxy ||
                `http://localhost:${proxyPort}`;

            let agent = getProxyHttpAgent({
                proxy: proxyUrl,
                endServerProtocol: 'http:'
            });

            try {
                console.log("Fetch ::::>")
                const response = await fetch(`http://localhost:${localApiServerPort}`, {
                    method: 'GET',
                    agent
                });

                console.log('response :::::::::////>')

                if (response.status === 200) {
                    const data = (await response.json()) as Res;

                    if (data) {
                        expect(data.host).toEqual(`localhost:${localApiServerPort}`);
                    } else {
                        throw new Error('No data from local server!');
                    }
                }
            } catch (err) {
                throw err;
            }
        });
    });

    // ______ Https local test server

    describe('Https local test server', () => {
        test('Test if it works with http (consuming a local https server api)', async () => {
            localApiHttpsServer.once('request', function (req, res) {
                res.end(JSON.stringify(req.headers));
            });

            let proxyUrl =
                process.env.HTTP_PROXY ||
                process.env.http_proxy ||
                `http://localhost:${proxyPort}`;

            let agent = getProxyHttpAgent({
                proxy: proxyUrl,
                rejectUnauthorized: false
            });

            const opts: any = url.parse(`https://localhost:${localApiHttpsServerPort}`);
            // opts.rejectUnauthorized = false;
            opts.agent = agent;

            console.log('get ::::')

            await new Promise<void>((resolve, reject) => {
                let req = https.get(opts, function (res) {
                    let data: any = '';
                    res.setEncoding('utf8');
                    res.on('data', function (b) {
                        data += b;
                        console.log('::::::::::::::::::::::::::::::::::::://///>')
                        console.log('data :::')
                        console.log(data)
                    });
                    res.on('end', function () {
                        console.log('RESPONSE END :::::::::::///////////////>')
                        data = JSON.parse(data);
                        console.log('END:::')
                        console.log(data)
                        expect(data.host).toEqual(`localhost:${localApiHttpsServerPort}`);
                        resolve();
                    });
                });
                req.once('error', reject);
            });
        });

        test('Test if it works with node fetch (consuming a local https server api)', async () => {
            localApiHttpsServer.once('request', function (req, res) {
                console.log('ONCE::::')
                res.end(JSON.stringify(req.headers));
            });

            let proxyUrl =
                process.env.HTTP_PROXY ||
                process.env.http_proxy ||
                `http://localhost:${proxyPort}`;

            let agent = getProxyHttpAgent({
                proxy: proxyUrl,
                rejectUnauthorized: false
            });

            try {
                console.log(('fetch :::: :: :: :: :'))
                const response = await fetch(`https://localhost:${localApiHttpsServerPort}`, {
                    method: 'GET',
                    agent
                });

                console.log('"response !!!!!!!!!!!!"')

                if (response.status === 200) {
                    const data = (await response.json()) as Res;

                    console.log(data)

                    if (data) {
                        expect(data.host).toEqual(`localhost:${localApiHttpsServerPort}`);
                    } else {
                        throw new Error('No data from local server!');
                    }
                }
            } catch (err) {
                throw err;
            }
        });
    });
});

// TODO: add test for an https proxy too
