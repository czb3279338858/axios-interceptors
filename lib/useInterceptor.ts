import { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import iAxios from "axios"
import { innerGetKey, paramsExcludeKey } from "./getKey";
import { cloneDeep } from "lodash-es";
import { innerIsSuccess } from "./isSuccess";
import { innerIsRetry } from "./isRetry";

interface UseInterceptorArg {
  axios: AxiosInstance,
  getKey?: typeof innerGetKey,
  useCache?: {
    isSuccess: typeof innerIsSuccess
  } | true,
  useDebounce?: boolean,
  useTimestamp?: {
    timestampKey?: string
  } | true,
  useRetry?: {
    isRetry?: typeof innerIsRetry
  } | true,
  useChange?: {
    requestListChange: (configs: AxiosRequestConfig[]) => void
  }
}
type CacheMap = Map<string, AxiosResponse>
declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * 当前接口是否在请求成功时缓存响应数据
     */
    _cache?: boolean,
    /**
     * 删除缓存的方法，比如更新了当前用户信息，应该删除当前用户信息缓存
     * @param cacheMap 
     * @returns 
     */
    _delCache?: (cacheMap: CacheMap) => void,
    /**
     * 当前接口是否不去抖动，用于获取获取唯一id这样的接口
     */
    _noDebounce?: boolean,
    /**
     * 真正向后端发起了请求的唯一id
     */
    _requestId?: number,
  }
  export interface AxiosResponse<T = any, D = any> {
    /**
     * 请求的额外返回，用于用户在生命周期结束后手动删除缓存
     * @returns 
     */
    _delCache?: () => void
  }
}
export function useInterceptor(arg: UseInterceptorArg) {
  const newAxios = iAxios.create()
  const { axios, useCache, useDebounce, useTimestamp, useRetry, useChange } = arg
  const getKey = arg.getKey || innerGetKey
  const isSuccess = useCache !== true && useCache?.isSuccess || innerIsSuccess
  const isRetry = useRetry !== true && useRetry?.isRetry || innerIsRetry
  const timestampKey = (useTimestamp && useTimestamp !== true && useTimestamp.timestampKey) ? useTimestamp.timestampKey : 'timestamp'
  paramsExcludeKey.push(timestampKey)

  const cacheMap: CacheMap = new Map()

  const debounceMap = new Map<string, {
    promise: Promise<AxiosResponse<unknown, unknown>>,
    resolve: (value: unknown) => void,
    reject: (reason?: unknown) => void
  }>()

  let requestId = 1
  /** 正在请求中的接口 */
  const realMap = new Map<number, {
    promise: Promise<AxiosResponse<unknown, unknown>>,
    resolve: (value: unknown) => void,
    reject: (reason?: unknown) => void,
    config: InternalAxiosRequestConfig
  }>()

  function callRequestListChange() {
    if (useChange) {
      let configs: AxiosRequestConfig[] = []
      realMap.forEach(r => configs.push(r.config))
      useChange.requestListChange(configs)
    }
  }

  const retryConfigs = new Set<AxiosRequestConfig>()

  axios.interceptors.request.use(config => {
    if (config._requestId) {
      const realConfig = cloneDeep(config)
      newAxios.request(realConfig)
      const real = realMap.get(config._requestId)
      if (real) {
        config.adapter = () => real.promise
      }
      return config
    }
    // 不带id的config
    const key = getKey(config)
    if (useCache && config._cache) {
      const response = cacheMap.get(key)
      // 有缓存的话直接响应接口
      if (response) {
        config.adapter = () => Promise.resolve(response)
        return config
      }
    }


    if (useDebounce && !config._noDebounce) {
      const debounceValue = debounceMap.get(key)
      if (debounceValue) {
        // 有debounce直接返回debouncePromise
        config.adapter = () => debounceValue.promise
        return config
      } else {
        // 没有创建debouncePromise
        let resolve
        let reject
        const promise = new Promise<AxiosResponse<unknown, unknown>>((res, rej) => {
          resolve = res
          reject = rej
        })
        if (resolve && reject)
          debounceMap.set(key, { promise, reject, resolve })
      }
    }

    // 设置id
    const realConfig = cloneDeep(config)
    realConfig._requestId = requestId

    // 给真实请求添加时间戳
    if (useTimestamp && realConfig.method?.toUpperCase() === 'GET') {
      realConfig.params ? (realConfig.params[timestampKey] = new Date().getTime()) : (realConfig.params = { [timestampKey]: new Date().getTime() })
    }
    // 发起真实请求
    newAxios.request(realConfig)

    // 发起请求的接口设置回调
    let resolve
    let reject
    const promise = new Promise<AxiosResponse<unknown, unknown>>((res, rej) => {
      resolve = res
      reject = rej
    })
    // 添加真实请求队列
    if (resolve && reject)
      realMap.set(requestId, { promise, reject, resolve, config: realConfig })
    // 通知队列改变
    callRequestListChange()
    requestId++

    // 所有页面请求都返回了promise，等待realMap的回调或者debounceMap的回调被调用
    config.adapter = () => promise
    return config
  })

  newAxios.interceptors.response.use(response => {
    const _requestId = response.config._requestId
    if (_requestId) {
      // 正常响应的数据也可以重新发起请求
      if (useRetry && response && isRetry(response)) {
        retryConfigs.add(response.config)
        return response
      }
      const resolveResponse = cloneDeep(response)
      delete resolveResponse.config._requestId
      const key = getKey(response.config)
      if (useDebounce && !response.config._noDebounce) {
        const debounceParams = debounceMap.get(key)
        // 响应debounce
        if (debounceParams) {
          debounceParams.resolve(resolveResponse)
          debounceMap.delete(key)
        }
      }
      if (useCache && isSuccess(response)) {
        // 响应cache
        if (response.config._cache) {
          response._delCache = () => cacheMap.delete(key)
          cacheMap.set(key, resolveResponse)
        }
        if (response.config._delCache) {
          response.config._delCache(cacheMap)
        }
      }
      // 响应真实请求列表
      const real = realMap.get(_requestId)
      if (real) {
        real.resolve(resolveResponse)
        realMap.delete(_requestId)
        callRequestListChange()
      }
    }
    return response
  }, (err: AxiosError) => {
    if (!err.config) return
    const key = getKey(err.config)
    const _requestId = err.config?._requestId
    if (_requestId) {
      const resolveErr = cloneDeep(err)

      // 接口504响应，err.response为undefined
      if (!err.response) {
        err.response = {
          data: undefined,
          status: 599,
          statusText: '没有响应体',
          headers: err.config.headers,
          config: err.config,
          request: err.request
        }
      }
      // 允许重试，重试的config带有_requestId
      if (useRetry && err.response && isRetry(err.response)) {
        retryConfigs.add(err.config)
        return err
      }

      // 不允许重试
      const real = realMap.get(_requestId)
      delete resolveErr.config?._requestId
      // 响应真实请求
      if (real) {
        real.reject(resolveErr)
        realMap.delete(_requestId)
        callRequestListChange()
      }
      // 响应debounce
      const debounceParams = debounceMap.get(key)
      if (debounceParams) {
        debounceParams.reject(resolveErr)
        debounceMap.delete(key)
      }
    }
    return err
  })

  function doRetry() {
    retryConfigs.forEach(config => {
      newAxios.request(config)
    })
    retryConfigs.clear()
  }
  return {
    doRetry
  }
}