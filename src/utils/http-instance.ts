import axios, { AxiosRequestConfig } from 'axios';
import { ProxyAgent } from 'proxy-agent';
import { USER_AGENT } from './constants';

const hasProxy = !!(
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy ||
  process.env.ALL_PROXY ||
  process.env.all_proxy
);

const agentOptions = hasProxy
  ? { proxy: false as const, httpAgent: new ProxyAgent(), httpsAgent: new ProxyAgent() }
  : {};

const traceMiddleware = <T extends AxiosRequestConfig>(request: T) => {
  if (request.headers) {
    request.headers['User-Agent'] = USER_AGENT;
  }
  return request;
};

export const commonHttpInstance = axios.create(agentOptions);
commonHttpInstance.interceptors.request.use(traceMiddleware, undefined, { synchronous: true });

export const oapiHttpInstance = axios.create(agentOptions);
oapiHttpInstance.interceptors.request.use(traceMiddleware, undefined, { synchronous: true });
oapiHttpInstance.interceptors.response.use((response) => response.data);
