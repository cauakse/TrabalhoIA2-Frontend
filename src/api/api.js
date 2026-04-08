import { API_BASE_URL, ENDPOINTS } from './endpoint'

function toQuery(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value))
    }
  })

  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const errorMessage = typeof payload === 'object' && payload?.message ? payload.message : 'Request failed'
    throw new Error(errorMessage)
  }

  return payload
}

async function streamSSEPost(path, { params = {}, onMessage, onDone, onError, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}${toQuery(params)}`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
    },
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error('Unable to start stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const eventBlock of events) {
        const lines = eventBlock
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)

        const dataLine = lines.find((line) => line.startsWith('data:'))
        if (!dataLine) continue

        const rawData = dataLine.replace(/^data:\s*/, '')
        const data = JSON.parse(rawData)

        if (data === 'DONE') {
          onDone?.()
          continue
        }

        onMessage?.(data)
      }
    }

    onDone?.()
  } catch (error) {
    onError?.(error)
    throw error
  } finally {
    reader.releaseLock()
  }
}

export const getDataHead = () => apiRequest(ENDPOINTS.data.head)
export const getData = () => apiRequest(ENDPOINTS.data.all)
export const removeNulls = () => apiRequest(ENDPOINTS.data.removeNulls, { method: 'POST' })
export const removeOutliers = () => apiRequest(ENDPOINTS.data.removeOutliers, { method: 'POST' })
export const normalizeData = () => apiRequest(ENDPOINTS.data.normalize, { method: 'POST' })
export const oneHotEncoding = () => apiRequest(ENDPOINTS.data.oneHotEncoding, { method: 'POST' })
export const splitData = (testSize = 0.2) =>
  apiRequest(`${ENDPOINTS.data.split}${toQuery({ test_size: testSize })}`, {
    method: 'POST',
  })
export const processAllData = (testSize = 0.2) =>
  apiRequest(`${ENDPOINTS.data.processAll}${toQuery({ test_size: testSize })}`, {
    method: 'POST',
  })
export const resetData = () => apiRequest(ENDPOINTS.data.reset, { method: 'POST' })
export const getDataStatus = () => apiRequest(ENDPOINTS.data.status)

export const buildModel = () => apiRequest(ENDPOINTS.model.build, { method: 'POST' })
export const evaluateModel = () => apiRequest(ENDPOINTS.model.evaluate)
export const resetModel = () => apiRequest(ENDPOINTS.model.reset, { method: 'POST' })
export const getMetrics = () => apiRequest(ENDPOINTS.model.metrics)
export const getConfusionMatrix = () => apiRequest(ENDPOINTS.model.confusionMatrix)
export const getModelStatus = () => apiRequest(ENDPOINTS.model.status)

export const trainModelStream = ({ epochs = 50, batchSize = 32, onMessage, onDone, onError, signal } = {}) =>
  streamSSEPost(ENDPOINTS.model.train, {
    params: { epochs, batch_size: batchSize },
    onMessage,
    onDone,
    onError,
    signal,
  })

export const doAllStream = ({ onMessage, onDone, onError, signal } = {}) =>
  streamSSEPost(ENDPOINTS.general.doAll, {
    onMessage,
    onDone,
    onError,
    signal,
  })

export const predict = (inputData) =>
  apiRequest(ENDPOINTS.general.predict, {
    method: 'POST',
    body: JSON.stringify(inputData),
  })

const api = {
  getDataHead,
  getData,
  removeNulls,
  removeOutliers,
  normalizeData,
  oneHotEncoding,
  splitData,
  processAllData,
  resetData,
  getDataStatus,
  buildModel,
  trainModelStream,
  evaluateModel,
  resetModel,
  getMetrics,
  getConfusionMatrix,
  getModelStatus,
  doAllStream,
  predict,
}

export default api
