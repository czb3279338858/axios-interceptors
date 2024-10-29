import { InternalAxiosRequestConfig } from "axios";
import { cloneDeep, isObject } from "lodash-es";

export const paramsExcludeKey: string[] = []

function objectToFormUrlEncoded(obj: Record<string, any>) {
  return Object.keys(obj).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`).join('&');
}
function getData(config: InternalAxiosRequestConfig) {
  let data: FormData | undefined | string | Record<string, any> = config.data
  // 'Content-Type': 'application/x-www-form-urlencoded'
  if (typeof data === 'string') {
    return data
  }
  if (data instanceof FormData) {
    let dataObj: Record<string, any> = {}
    data.forEach((v, k) => {
      dataObj[k] = v
    })
    return objectToFormUrlEncoded(dataObj)
  }
  if (isObject(data)) {
    if (config.headers['Content-Type'] === 'multipart/form-data') {
      const formData = new FormData()
      Object.keys(data).forEach(key => {
        formData.append(key, data[key])
      })
      let dataObj: Record<string, any> = {}
      formData.forEach((v, k) => {
        dataObj[k] = v
      })
      return objectToFormUrlEncoded(dataObj)
    } else {
      return objectToFormUrlEncoded(data)
    }
  }
  return data

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