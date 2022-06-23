import { AxiosRequestConfig } from 'axios'
import qs from 'qs'

export function requestFormUrlencoded(config: AxiosRequestConfig<any>): AxiosRequestConfig<any> {
  const headers = config.headers
  const contentType = headers?.['Content-Type']
  const data = config.data
  if (contentType === 'application/x-www-form-urlencoded' && (typeof data !== 'string')) {
    return {
      ...config,
      data: qs.stringify(data)
    }
  }
  if (contentType === 'application/json' && typeof data !== 'string') {
    return {
      ...config,
      data: JSON.stringify(data)
    }
  }
  return config
}