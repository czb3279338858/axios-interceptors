import { InternalAxiosRequestConfig } from "axios";
import { cloneDeep, isObject, isPlainObject } from "lodash-es";

export const paramsExcludeKey: string[] = []



function getData(config: InternalAxiosRequestConfig): string {
  const { transformRequest, data, headers } = config
  // 请求中
  if (!config._requestId && transformRequest) {

    if (typeof transformRequest === 'function') {
      const ret = transformRequest?.call(config, data, headers) || data
      return JSON.stringify(ret)
    } else {
      // 在旧版本的axios中transformRequest可能是个{0：function}的对象
      const ret = Object.keys(transformRequest).reduce<any>((p, key, index) => {
        const c = transformRequest[key as unknown as number]
        if (index === 0) p = c.call(config, data, headers)
        return p
      }, null)
      return JSON.stringify(ret)
    }
  } else {
    return JSON.stringify(data)
  }
}

export function innerGetKey(config: InternalAxiosRequestConfig) {
  const url = new URL(config.url!, config.baseURL);
  const fullURL = url.protocol + '//' + url.hostname + url.pathname;
  const data = getData(config)
  const params = cloneDeep(config.params || {})
  url.searchParams.forEach((value, key) => params[key] = value)
  if (paramsExcludeKey.length) {
    paramsExcludeKey.forEach(key => {
      delete params[key]
    })
  }
  const method = config.method;
  return JSON.stringify({ fullURL, data, params, method })
}