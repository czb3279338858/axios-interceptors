import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { useInterceptor } from '../lib/main'
import { merge } from 'lodash-es'
const selfAxios = axios.create()
merge(selfAxios.defaults, {
  headers: {
    common: {
      Appcode: 'MTDS',
      Subappcode: 'MTDSPC001',
      "Oauth2-Accesstoken": '653a4c82ceb5cb240727737c8c7b564au'
    }
  },
  baseURL: 'https://apigatewayuat.oppein.com'
})

const requestListChange = (configs: AxiosRequestConfig[]) => {
  console.log(configs)
}
const {
  // A method for re-initiating failed requests.
  doRetry
} = useInterceptor({
  axios: selfAxios,
  // Using the data caching feature, data is only cached when isSuccess returns true.
  useCache: {
    isSuccess: (v: AxiosResponse) => v.status >= 200 && v.status < 300 && v.data.code === '100000'
  },
  // Using the request deduplication feature, when a request has not returned, but is initiated again elsewhere, they will be merged into one.
  // But be aware that some interfaces cannot be deduplicated, such as the interface for obtaining the unique id of the uploaded file.
  useDebounce: true,
  // Add a timestamp parameter to the get request.
  useTimestamp: true,
  // When a request fails, it is allowed to re-initiate the request through the doRetry method. The return of isRetry determines whether the request needs to be added to the re-initiation queue.
  useRetry: {
    isRetry: (err: AxiosError) => !!err.response?.status && err.response.status >= 500 && err.response.status < 600
  },
  // The requestListChange method is called when the queue of pending requests changes, and the queue is passed as a parameter. For example, after a request is responded, the number of requests in the queue decreases by 1, and the requestListChange method is triggered.
  useChange: {
    requestListChange
  }
})

function getJson() {
  return selfAxios.get('/ucenterapi/uc/internal/common/getCurrentUser', {
    params: {
      platformType: 'MTDS'
    }
  })
}
export async function postFormData() {
  return selfAxios.post('/quotation/designQuotationExportController/exportDesignQuotationDetailByQuotationId', { id: 1777184063947182081, other: [1, { a: 2 }] }, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
export async function postUrlencoded() {
  return selfAxios.post('/mtdsaccount/account-quotation/getVipBillingItemByOrgNo', { orgNo: 's000044', other: [1, { a: 2 }] }, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
}
async function init() {
  await getJson()
  await getJson()
  await postFormData()
  await postFormData()
  await postUrlencoded()
  await postUrlencoded()
}
init()