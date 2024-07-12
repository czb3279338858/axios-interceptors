import { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { paramsExcludeKey } from './getKey'
interface TimestampInterceptorArg {
  axios: AxiosInstance,
  timestampKey?: string
}
export function useTimestampInterceptor(arg: TimestampInterceptorArg) {
  const { axios } = arg;
  const timestampKey = arg.timestampKey || 'timestamp'
  paramsExcludeKey.push(timestampKey)
  axios.interceptors.request.use(function (config): InternalAxiosRequestConfig {
    if (config.method?.toUpperCase() === 'GET') {
      if (config.params) {
        config.params[timestampKey] = new Date().getTime()
      } else {
        config.params = { [timestampKey]: new Date().getTime() }
      }
      return config
    }
    return config
  })
}