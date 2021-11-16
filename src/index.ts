import * as https from 'https';
type HttpsAgent = https.Agent;
import * as http from 'http';
type HttpAgent = http.Agent;
import * as tunnel from 'tunnel';
import { Spread } from './types/utils';

export type IAgentOptions = tunnel.HttpOptions | tunnel.HttpOverHttpsOptions | tunnel.HttpsOverHttpOptions | tunnel.HttpsOverHttpsOptions;

export type IProxyOptions = tunnel.ProxyOptions & { protocol: 'http:' | 'https:' };

export type IProxyHttpsOptions = tunnel.HttpsProxyOptions & { protocol: 'http:' | 'https:' };

export type IOptions = Spread<
        Partial<https.AgentOptions> &
        IAgentOptions
        , {
            proxy: IProxyOptions | IProxyHttpsOptions | string,
            endServerProtocol?: 'http:' | 'https:'
        }
    >;

export function getProxyHttpAgent(options: IOptions): http.Agent | https.Agent  {
    if (!options.proxy) {
        throw new Error('Proxy not provided');
    }

    if (typeof options.proxy === 'string') {
        const parsedUrl = new URL(options.proxy);
        options.proxy = {
            ...parsedUrl,
            port: Number(parsedUrl.port)
        };
    }

    const proxy = options.proxy as IProxyOptions | IProxyHttpsOptions;

    if (!options.endServerProtocol) {
        options.endServerProtocol = 'https:';
    }

    let agent: http.Agent | https.Agent;

    if (proxy.protocol === 'http:') {
        if (options.endServerProtocol === 'http:') {
            agent = tunnel.httpOverHttp(options as any);
        } else {
            /**
             * https
             */
            agent = tunnel.httpsOverHttp(options as any);
        }
    } else {
        /**
         * https
         */
        if (options.endServerProtocol === 'http:') {
            agent = tunnel.httpOverHttps(options as any);
        } else {
            /**
             * https
             */
            agent = tunnel.httpsOverHttps(options as any);
        }
    }

    if (process.env.NODE_ENV === 'test') {
        // @ts-ignore
        agent.test_endServerProtocol = options.endServerProtocol;
    }

    return agent;
}

export { HttpsAgent, HttpAgent };
