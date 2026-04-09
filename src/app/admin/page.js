'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildModel,
  doAllStream,
  getData,
  getDataHead,
  getConfusionMatrix,
  evaluateModel,
  getDataStatus,
  getMetrics,
  getModelStatus,
  normalizeData,
  oneHotEncoding,
  processAllData,
  removeNulls,
  removeOutliers,
  resetData,
  resetModel,
  splitData,
  trainModelStream,
} from '@/api/api'
import { useAlert } from '@/components/Alert'
import { useTheme } from '@/components/ThemeProvider'

const CLASS_NAME_BY_INDEX = {
  0: 'Insufficient_Weight',
  1: 'Normal_Weight',
  2: 'Overweight_Level_I',
  3: 'Overweight_Level_II',
  4: 'Obesity_Type_I',
  5: 'Obesity_Type_II',
  6: 'Obesity_Type_III',
}

const METRIC_DESCRIPTIONS = {
  accuracy: 'Proporção total de previsões corretas em todas as classes.',
  precision_macro: 'Média da precisão por classe com peso igual para todas as classes.',
  precision_weighted: 'Média da precisão ponderada pela quantidade de exemplos por classe.',
  recall_macro: 'Média do recall por classe com peso igual para todas as classes.',
  recall_weighted: 'Média do recall ponderada pelo tamanho das classes.',
  f1_macro: 'Média do F1 por classe com peso igual. Balanceia precisão e recall.',
  f1_weighted: 'Média do F1 ponderada pelo tamanho das classes.',
}

function formatClassName(value) {
  return String(value || '').replaceAll('_', ' ')
}

function getDisplayClassName(value) {
  const key = String(value ?? '')
  return formatClassName(CLASS_NAME_BY_INDEX[key] || value)
}

function parsePossibleJson(value) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function toNumeric(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (value && typeof value === 'object') {
    if (typeof value.parsedValue === 'number') return value.parsedValue
    if (typeof value.source === 'string') {
      const parsed = Number(value.source)
      return Number.isFinite(parsed) ? parsed : null
    }
  }
  return null
}

function formatPercent(value) {
  const numeric = toNumeric(value)
  if (numeric === null) return 'N/A'
  return `${(numeric * 100).toFixed(2)}%`
}

function formatDecimal(value, decimals = 4) {
  const numeric = toNumeric(value)
  if (numeric === null) return 'N/A'
  return numeric.toFixed(decimals)
}

function extractRowsFromPayload(payload, preferredKey) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  if (Array.isArray(payload[preferredKey])) return payload[preferredKey]
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.items)) return payload.items

  return []
}

function getTableColumns(rows) {
  if (!rows.length) return []

  const ordered = []
  const seen = new Set()

  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return

    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key)
        ordered.push(key)
      }
    })
  })

  return ordered
}

function formatTableCell(value) {
  if (value === null || typeof value === 'undefined') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseConfusionMatrixPayload(payload) {
  let matrix = []
  let labels = []

  if (Array.isArray(payload)) {
    matrix = payload
  } else if (payload && typeof payload === 'object') {
    matrix = payload.confusion_matrix || payload.confusionMatrix || payload.matrix || payload.data || []
    labels = payload.labels || payload.classes || payload.class_names || payload.classNames || []
  }

  const isValidMatrix = Array.isArray(matrix) && matrix.every((row) => Array.isArray(row))
  if (!isValidMatrix) {
    return { matrix: [], labels: [] }
  }

  const size = matrix[0]?.length || 0
  const normalizedLabels = Array.isArray(labels) && labels.length === size ? labels : Array.from({ length: size }, (_, index) => String(index))

  return {
    matrix,
    labels: normalizedLabels,
  }
}

function DataStateTable({ title, rows, isDark = false }) {
  const columns = useMemo(() => getTableColumns(rows), [rows])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{rows.length} registro(s)</p>
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <p className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-zinc-700 bg-zinc-950 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
          Sem dados para exibir.
        </p>
      ) : (
        <div className={`overflow-auto rounded-lg border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
          <table className="min-w-max text-xs">
            <thead className={`${isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>
              <tr>
                {columns.map((column) => (
                  <th key={column} className="max-w-56 px-3 py-2 text-left font-semibold wrap-break-word">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className={`border-t align-top ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                  {columns.map((column) => (
                    <td key={`${rowIndex}-${column}`} className={`max-w-64 px-3 py-2 wrap-break-word ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                      {formatTableCell(row?.[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConfusionMatrixTable({ matrix, labels, isDark = false }) {
  if (!matrix.length || !labels.length) {
    return (
      <p className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-zinc-700 bg-zinc-950 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
        Sem dados de matriz de confusão.
      </p>
    )
  }

  const numericValues = matrix.flatMap((row) => row.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0)))
  const maxValue = Math.max(...numericValues, 1)

  const getCellStyle = (value, rowIndex, colIndex) => {
    const numeric = Number(value)
    const normalized = Number.isFinite(numeric) ? numeric / maxValue : 0
    const alpha = Math.max(0.08, Math.min(0.75, normalized * 0.75))

    if (isDark) {
      const bg = rowIndex === colIndex ? `rgba(16, 185, 129, ${alpha})` : `rgba(56, 189, 248, ${alpha * 0.85})`
      return { backgroundColor: bg }
    }

    const bg = rowIndex === colIndex ? `rgba(16, 185, 129, ${alpha * 0.7})` : `rgba(14, 165, 233, ${alpha * 0.55})`
    return { backgroundColor: bg }
  }

  return (
    <div className={`h-full overflow-y-auto rounded-xl border p-2 ${isDark ? 'border-zinc-700 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50'}`}>
      <table className="w-full table-fixed border-separate border-spacing-1 text-[11px]">
        <thead>
          <tr>
            <th className={`w-40 rounded-md px-2 py-2 text-left font-semibold wrap-break-word ${isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>Real \ Predito</th>
            {labels.map((label) => (
              <th key={`pred-${label}`} className={`rounded-md px-1 py-2 text-center font-semibold wrap-break-word ${isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                {getDisplayClassName(label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rowIndex) => (
            <tr key={`cm-row-${rowIndex}`}>
              <td className={`rounded-md px-2 py-2 font-semibold wrap-break-word ${isDark ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-100 text-zinc-900'}`}>
                {getDisplayClassName(labels[rowIndex] || String(rowIndex))}
              </td>
              {row.map((value, colIndex) => (
                <td
                  key={`cm-cell-${rowIndex}-${colIndex}`}
                  style={getCellStyle(value, rowIndex, colIndex)}
                  className={`rounded-md px-1 py-2 text-center font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  {formatTableCell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrainingLogItem({ log, index, isDark = false }) {
  const parsed = typeof log === 'object' ? log : parsePossibleJson(log)
  const isEpochLog = parsed && typeof parsed === 'object' && typeof parsed.epoch !== 'undefined'

  if (!isEpochLog) {
    return (
      <div className={`rounded-md border px-3 py-2 ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
        <p className={`text-xs ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{typeof log === 'string' ? log : JSON.stringify(log)}</p>
      </div>
    )
  }

  return (
    <div className={`rounded-md border px-3 py-2 ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
      <p className={`mb-2 text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Época {parsed.epoch}</p>
      <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div className={`rounded px-2 py-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
          <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Accuracy</p>
          <p className="font-semibold text-emerald-300">{formatPercent(parsed.accuracy)}</p>
        </div>
        <div className={`rounded px-2 py-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
          <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Loss</p>
          <p className={`font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{formatDecimal(parsed.loss)}</p>
        </div>
        <div className={`rounded px-2 py-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
          <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Val accuracy</p>
          <p className="font-semibold text-sky-300">{formatPercent(parsed.val_accuracy)}</p>
        </div>
        <div className={`rounded px-2 py-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
          <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Val loss</p>
          <p className={`font-semibold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{formatDecimal(parsed.val_loss)}</p>
        </div>
      </div>
      <p className={`mt-2 text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>#{index + 1}</p>
    </div>
  )
}

function LineChart({ data, series, yMin = null, yMax = null, isDark = false }) {
  const width = 720
  const height = 220
  const padding = 28

  if (!data.length) {
    return (
      <div
        className={`flex h-55 items-center justify-center rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-900 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
        <p className="text-sm">Sem dados para o gráfico.</p>
      </div>
    )
  }

  const values = data.flatMap((point) => series.map((s) => toNumeric(point[s.key])).filter((value) => value !== null))
  const minValue = yMin ?? Math.min(...values)
  const maxValue = yMax ?? Math.max(...values)
  const safeRange = maxValue - minValue || 1

  const getX = (index) => {
    if (data.length === 1) return width / 2
    return padding + (index / (data.length - 1)) * (width - padding * 2)
  }

  const getY = (value) => height - padding - ((value - minValue) / safeRange) * (height - padding * 2)

  return (
    <div className={`overflow-hidden rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className={isDark ? 'stroke-zinc-700' : 'stroke-zinc-300'} strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className={isDark ? 'stroke-zinc-700' : 'stroke-zinc-300'} strokeWidth="1" />

        {series.map((line) => {
          const points = data
            .map((point, index) => {
              const value = toNumeric(point[line.key])
              if (value === null) return null
              return `${getX(index)},${getY(value)}`
            })
            .filter(Boolean)
            .join(' ')

          return <polyline key={line.key} points={points} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        })}
      </svg>
    </div>
  )
}

function TrainingConvergenceChart({ trainingHistory, isDark = false }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Convergência (Accuracy)</p>
        <LineChart
          data={trainingHistory}
          yMin={0}
          yMax={1}
          isDark={isDark}
          series={[
            { key: 'accuracy', color: '#10b981', label: 'Accuracy' },
            { key: 'val_accuracy', color: '#38bdf8', label: 'Val accuracy' },
          ]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Convergência (Loss)</p>
        <LineChart
          data={trainingHistory}
          isDark={isDark}
          series={[
            { key: 'loss', color: '#f59e0b', label: 'Loss' },
            { key: 'val_loss', color: '#f43f5e', label: 'Val loss' },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Accuracy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          Val accuracy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Loss
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Val loss
        </span>
      </div>
    </div>
  )
}

function MetricsPanel({ data, isDark = false }) {
  if (!data) {
    return <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Clique em Get Metrics para carregar.</p>
  }

  const summary = data?.metrics || {}
  const report = data?.classification_report || {}

  const classRows = Object.entries(report).filter(([key, value]) => /^\d+$/.test(key) && value && typeof value === 'object')
  const aggregateRows = Object.entries(report).filter(([key, value]) => (key === 'macro avg' || key === 'weighted avg') && value && typeof value === 'object')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className={`rounded-lg border px-3 py-2 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{key}</p>
            <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{formatPercent(value)}</p>
            <p className={`mt-1 text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{METRIC_DESCRIPTIONS[key] || 'Métrica de avaliação do modelo.'}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-lg border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
        <table className="w-full table-fixed text-sm">
          <thead className={`${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>
            <tr>
              <th className="px-3 py-2 text-left">Classe</th>
              <th className="px-3 py-2 text-left">Precision</th>
              <th className="px-3 py-2 text-left">Recall</th>
              <th className="px-3 py-2 text-left">F1-Score</th>
              <th className="px-3 py-2 text-left">Support</th>
            </tr>
          </thead>
          <tbody>
            {classRows.map(([classId, row]) => (
              <tr key={classId} className={`border-t ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                <td className={`px-3 py-2 font-medium wrap-break-word ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                  {formatClassName(CLASS_NAME_BY_INDEX[classId] || classId)}
                </td>
                <td className="px-3 py-2">{formatPercent(row.precision)}</td>
                <td className="px-3 py-2">{formatPercent(row.recall)}</td>
                <td className="px-3 py-2">{formatPercent(row['f1-score'])}</td>
                <td className="px-3 py-2">{formatDecimal(row.support, 0)}</td>
              </tr>
            ))}

            {aggregateRows.map(([name, row]) => (
              <tr key={name} className={`border-t ${isDark ? 'border-zinc-700 bg-zinc-800/60' : 'border-zinc-200 bg-zinc-50'}`}>
                <td className={`px-3 py-2 font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{name}</td>
                <td className="px-3 py-2 font-medium">{formatPercent(row.precision)}</td>
                <td className="px-3 py-2 font-medium">{formatPercent(row.recall)}</td>
                <td className="px-3 py-2 font-medium">{formatPercent(row['f1-score'])}</td>
                <td className="px-3 py-2 font-medium">{formatDecimal(row.support, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
        <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Accuracy geral</p>
        <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{formatPercent(report.accuracy ?? summary.accuracy)}</p>
      </div>
    </div>
  )
}

function StatusBadge({ value, isDark = false }) {
  const ok = value === true
  const style = ok ? (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-700'

  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{ok ? 'OK' : 'Pendente'}</span>
}

function ActionButton({ label, onClick, disabled, variant = 'default', isDark = false }) {
  const variantClass =
    variant === 'danger'
      ? isDark
        ? 'border-rose-500/50 text-rose-300 hover:bg-rose-500/10'
        : 'border-rose-300 text-rose-700 hover:bg-rose-50'
      : isDark
        ? 'border-zinc-600 text-zinc-100 hover:bg-zinc-800'
        : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${variantClass} disabled:cursor-not-allowed disabled:opacity-50`}>
      {label}
    </button>
  )
}

export default function AdminPage() {
  const [dataStatus, setDataStatus] = useState({})
  const [modelStatus, setModelStatus] = useState({})
  const [dataStateModalOpen, setDataStateModalOpen] = useState(false)
  const [isLoadingDataState, setIsLoadingDataState] = useState(false)
  const [activeDataStateView, setActiveDataStateView] = useState('head')
  const [dataStatePayload, setDataStatePayload] = useState(null)
  const [confusionMatrixModalOpen, setConfusionMatrixModalOpen] = useState(false)
  const [isLoadingConfusionMatrix, setIsLoadingConfusionMatrix] = useState(false)
  const [confusionMatrixPayload, setConfusionMatrixPayload] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [streamLogs, setStreamLogs] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [runningAction, setRunningAction] = useState('')
  const [splitTestSize, setSplitTestSize] = useState(0.2)
  const [trainConfig, setTrainConfig] = useState({ epochs: 50, batchSize: 32 })
  const logsContainerRef = useRef(null)
  const { showError, showSuccess } = useAlert()
  const { isDark } = useTheme()

  const dataItems = useMemo(() => Object.entries(dataStatus || {}), [dataStatus])
  const modelItems = useMemo(() => Object.entries(modelStatus || {}).filter(([key]) => key !== 'metrics'), [modelStatus])
  const trainingHistory = useMemo(() => {
    return streamLogs
      .map((entry) => (typeof entry === 'object' ? entry : parsePossibleJson(entry)))
      .filter((entry) => entry && typeof entry === 'object' && typeof entry.epoch !== 'undefined')
      .sort((a, b) => Number(a.epoch) - Number(b.epoch))
  }, [streamLogs])
  const dataStateRows = useMemo(() => {
    return {
      head: extractRowsFromPayload(dataStatePayload?.head, 'head'),
      data: extractRowsFromPayload(dataStatePayload?.data, 'data'),
    }
  }, [dataStatePayload])
  const parsedConfusionMatrix = useMemo(() => parseConfusionMatrixPayload(confusionMatrixPayload), [confusionMatrixPayload])

  const appendLog = (message) => {
    setStreamLogs((prev) => [...prev, message])
  }

  const refreshStatus = async () => {
    try {
      setIsRefreshing(true)
      const [dataRes, modelRes] = await Promise.all([getDataStatus(), getModelStatus()])
      setDataStatus(dataRes?.status || {})
      setModelStatus(modelRes?.status || {})
    } catch (error) {
      showError(error?.message || 'Erro ao atualizar status', { title: 'Admin' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const runAction = async (name, fn, successMessage) => {
    try {
      setRunningAction(name)
      await fn()

      if (name === 'resetModel') {
        setMetrics(null)
        setStreamLogs([])
      }

      showSuccess(successMessage, { title: 'Admin' })
      await refreshStatus()
    } catch (error) {
      showError(error?.message || `Erro em ${name}`, { title: 'Admin' })
    } finally {
      setRunningAction('')
    }
  }

  const handleTrain = async () => {
    try {
      setRunningAction('train')
      setStreamLogs([])
      appendLog('Iniciando treino...')

      await trainModelStream({
        epochs: Number(trainConfig.epochs) || 50,
        batchSize: Number(trainConfig.batchSize) || 32,
        onMessage: (data) => appendLog(data),
        onDone: () => appendLog('Treino finalizado.'),
      })

      showSuccess('Treino executado com sucesso', { title: 'Admin' })
      await refreshStatus()
    } catch (error) {
      showError(error?.message || 'Erro no treino', { title: 'Admin' })
    } finally {
      setRunningAction('')
    }
  }

  const handleDoAll = async () => {
    try {
      setRunningAction('doAll')
      setStreamLogs([])
      appendLog('Iniciando fluxo completo...')

      await doAllStream({
        onMessage: (data) => appendLog(data),
        onDone: () => appendLog('Fluxo completo finalizado.'),
      })

      showSuccess('Fluxo completo executado com sucesso', { title: 'Admin' })
      await refreshStatus()
    } catch (error) {
      showError(error?.message || 'Erro no fluxo completo', { title: 'Admin' })
    } finally {
      setRunningAction('')
    }
  }

  const handleGetMetrics = async () => {
    try {
      setRunningAction('metrics')
      const response = await getMetrics()
      setMetrics(response)
      showSuccess('Métricas carregadas', { title: 'Admin' })
    } catch (error) {
      showError(error?.message || 'Erro ao buscar métricas', { title: 'Admin' })
    } finally {
      setRunningAction('')
    }
  }

  const handleViewConfusionMatrix = async () => {
    try {
      setIsLoadingConfusionMatrix(true)
      const response = await getConfusionMatrix()
      setConfusionMatrixPayload(response)
      setConfusionMatrixModalOpen(true)
    } catch (error) {
      showError(error?.message || 'Erro ao buscar matriz de confusão', { title: 'Admin' })
    } finally {
      setIsLoadingConfusionMatrix(false)
    }
  }

  const handleViewDataState = async () => {
    try {
      setIsLoadingDataState(true)
      const [headRes, dataRes] = await Promise.all([getDataHead(), getData()])
      setDataStatePayload({
        head: headRes,
        data: dataRes,
      })
      setActiveDataStateView('head')
      setDataStateModalOpen(true)
    } catch (error) {
      showError(error?.message || 'Erro ao visualizar estado dos dados', { title: 'Admin' })
    } finally {
      setIsLoadingDataState(false)
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  useEffect(() => {
    const container = logsContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [streamLogs])

  return (
    <>
      <main className={`min-h-screen p-6 transition-colors ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <section className={`rounded-xl border p-6 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Admin</h1>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Controle o pipeline de dados e o ciclo de treinamento do modelo.</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={isRefreshing || !!runningAction}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}>
                  {isRefreshing ? 'Atualizando...' : 'Atualizar status'}
                </button>

                <button
                  type="button"
                  onClick={handleViewDataState}
                  disabled={isLoadingDataState || isRefreshing || !!runningAction}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}>
                  {isLoadingDataState ? 'Carregando dados...' : 'Visualizar estado dos dados'}
                </button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={`rounded-xl border p-4 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
              <h2 className="mb-3 text-sm font-semibold">Status de dados</h2>
              <div className="space-y-2">
                {dataItems.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Sem dados de status.</p>
                ) : (
                  dataItems.map(([key, value]) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
                      <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{key}</span>
                      <StatusBadge value={value} isDark={isDark} />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={`rounded-xl border p-4 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
              <h2 className="mb-3 text-sm font-semibold">Status de modelo</h2>
              <div className="space-y-2">
                {modelItems.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Sem dados de status.</p>
                ) : (
                  modelItems.map(([key, value]) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
                      <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{key}</span>
                      <StatusBadge value={value} isDark={isDark} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className={`rounded-xl border p-4 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <h2 className="mb-3 text-sm font-semibold">Ações de dados</h2>

            <div className="mb-3 flex items-center gap-2">
              <label className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>Test size:</label>
              <input
                type="number"
                min="0.05"
                max="0.5"
                step="0.05"
                value={splitTestSize}
                onChange={(event) => setSplitTestSize(event.target.value)}
                className={`w-24 rounded-lg border px-2 py-1 text-sm ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-300 bg-white'}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <ActionButton label="Remove Nulls" onClick={() => runAction('removeNulls', removeNulls, 'Nulls removidos')} disabled={!!runningAction} isDark={isDark} />
              <ActionButton label="Remove Outliers" onClick={() => runAction('removeOutliers', removeOutliers, 'Outliers removidos')} disabled={!!runningAction} isDark={isDark} />
              <ActionButton label="Normalize" onClick={() => runAction('normalize', normalizeData, 'Dados normalizados')} disabled={!!runningAction} isDark={isDark} />
              <ActionButton
                label="One-Hot Encoding"
                onClick={() => runAction('oneHotEncoding', oneHotEncoding, 'One-hot encoding concluído')}
                disabled={!!runningAction}
                isDark={isDark}
              />
              <ActionButton
                label="Split Data"
                onClick={() => runAction('splitData', () => splitData(Number(splitTestSize) || 0.2), 'Split concluído')}
                disabled={!!runningAction}
                isDark={isDark}
              />
              <ActionButton
                label="Processar Tudo"
                onClick={() => runAction('processAllData', () => processAllData(Number(splitTestSize) || 0.2), 'Processamento completo concluído')}
                disabled={!!runningAction}
                isDark={isDark}
              />
              <ActionButton label="Reset Data" onClick={() => runAction('resetData', resetData, 'Dados resetados')} disabled={!!runningAction} variant="danger" isDark={isDark} />
            </div>
          </section>

          <section className={`rounded-xl border p-4 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <h2 className="mb-3 text-sm font-semibold">Ações de modelo</h2>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={`rounded-lg border p-3 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
                <p className={`mb-2 text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>Treinamento</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={trainConfig.epochs}
                    onChange={(event) => setTrainConfig((prev) => ({ ...prev, epochs: event.target.value }))}
                    className={`w-24 rounded-lg border px-2 py-1 text-sm ${isDark ? 'border-zinc-600 bg-zinc-900' : 'border-zinc-300 bg-white'}`}
                    placeholder="Épocas"
                  />
                  <input
                    type="number"
                    min="1"
                    value={trainConfig.batchSize}
                    onChange={(event) => setTrainConfig((prev) => ({ ...prev, batchSize: event.target.value }))}
                    className={`w-24 rounded-lg border px-2 py-1 text-sm ${isDark ? 'border-zinc-600 bg-zinc-900' : 'border-zinc-300 bg-white'}`}
                    placeholder="Batch"
                  />
                  <ActionButton label={runningAction === 'train' ? 'Treinando...' : 'Treinar'} onClick={handleTrain} disabled={!!runningAction} isDark={isDark} />
                </div>
              </div>

              <div className={`rounded-lg border p-3 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
                <p className={`mb-2 text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>Execução completa</p>
                <ActionButton label={runningAction === 'doAll' ? 'Executando...' : 'Do All'} onClick={handleDoAll} disabled={!!runningAction} isDark={isDark} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ActionButton label="Build Model" onClick={() => runAction('buildModel', buildModel, 'Modelo construído')} disabled={!!runningAction} isDark={isDark} />
              <ActionButton label="Evaluate" onClick={() => runAction('evaluate', evaluateModel, 'Modelo avaliado')} disabled={!!runningAction} isDark={isDark} />
              <ActionButton label="Get Metrics" onClick={handleGetMetrics} disabled={!!runningAction} isDark={isDark} />
              <ActionButton
                label={isLoadingConfusionMatrix ? 'Carregando matriz...' : 'Matriz de Confusão'}
                onClick={handleViewConfusionMatrix}
                disabled={!!runningAction || isLoadingConfusionMatrix}
                isDark={isDark}
              />
              <ActionButton
                label="Reset Model"
                onClick={() => runAction('resetModel', resetModel, 'Modelo resetado')}
                disabled={!!runningAction}
                variant="danger"
                isDark={isDark}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`rounded-xl border p-4 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
              <h2 className="mb-2 text-sm font-semibold">Gráfico de convergência</h2>
              <TrainingConvergenceChart trainingHistory={trainingHistory} isDark={isDark} />

              <div className={`my-4 border-t ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`} />

              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Logs de execução</h2>
                <button
                  type="button"
                  onClick={() => setStreamLogs([])}
                  className={`text-xs transition ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}>
                  Limpar logs
                </button>
              </div>

              <div
                ref={logsContainerRef}
                className={`max-h-80 space-y-1 overflow-auto rounded-lg border p-3 text-xs ${isDark ? 'border-zinc-700 bg-zinc-950 text-zinc-100' : 'border-zinc-200 bg-zinc-50 text-zinc-900'}`}>
                {streamLogs.length === 0 ? (
                  <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Sem logs ainda.</p>
                ) : (
                  streamLogs.map((line, index) => <TrainingLogItem key={`log-${index}`} log={line} index={index} isDark={isDark} />)
                )}
              </div>
            </div>

            <div className={`rounded-xl border p-4 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
              <h2 className="mb-2 text-sm font-semibold">Métricas</h2>
              <MetricsPanel data={metrics} isDark={isDark} />
            </div>
          </section>
        </div>
      </main>

      {dataStateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Estado dos dados">
          <div
            className={`flex h-[92vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden rounded-xl border shadow-xl ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
              <h2 className="text-sm font-semibold">Estado dos dados (Tabela)</h2>
              <button
                type="button"
                onClick={() => setDataStateModalOpen(false)}
                className={`rounded px-2 py-1 text-sm transition ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                Fechar
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDataStateView('head')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    activeDataStateView === 'head'
                      ? isDark
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                        : 'border-sky-300 bg-sky-50 text-sky-700'
                      : isDark
                        ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
                  }`}>
                  /data/head
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDataStateView('data')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    activeDataStateView === 'data'
                      ? isDark
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                        : 'border-sky-300 bg-sky-50 text-sky-700'
                      : isDark
                        ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
                  }`}>
                  /data
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {activeDataStateView === 'head' ? (
                  <DataStateTable title="Dados de /data/head" rows={dataStateRows.head} isDark={isDark} />
                ) : (
                  <DataStateTable title="Dados de /data" rows={dataStateRows.data} isDark={isDark} />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confusionMatrixModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Matriz de confusão">
          <div className={`flex max-h-[78vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
              <h2 className="text-base font-semibold">Matriz de Confusão</h2>
              <button
                type="button"
                onClick={() => setConfusionMatrixModalOpen(false)}
                className={`rounded px-2 py-1 text-sm transition ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 p-4">
              <div className="min-h-0 flex-1 overflow-auto">
                <ConfusionMatrixTable matrix={parsedConfusionMatrix.matrix} labels={parsedConfusionMatrix.labels} isDark={isDark} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
