const API_BASE_URL = 'http://localhost:8000'

const ENDPOINTS = {
  data: {
    head: '/data/head',
    all: '/data',
    removeNulls: '/data/removeNulls',
    removeOutliers: '/data/removeOutliers',
    normalize: '/data/normalize',
    oneHotEncoding: '/data/oneHotEncoding',
    split: '/data/split',
    processAll: '/data/processAll',
    reset: '/data/reset',
    status: '/data/status',
  },
  model: {
    build: '/model/build',
    train: '/model/train',
    evaluate: '/model/evaluate',
    reset: '/model/reset',
    metrics: '/model/metrics',
    confusionMatrix: '/model/confusionMatrix',
    status: '/model/status',
  },
  general: {
    doAll: '/doAll',
    predict: '/predict',
  },
}

export { API_BASE_URL, ENDPOINTS }
