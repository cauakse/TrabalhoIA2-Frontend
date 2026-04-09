'use client'

import { useMemo, useState } from 'react'
import { getDataStatus, getModelStatus, predict } from '@/api/api'
import { useAlert } from '@/components/Alert'
import { useTheme } from '@/components/ThemeProvider'

const INITIAL_FORM = {
  Gender: '',
  Age: '',
  Height: '',
  Weight: '',
  family_history_with_overweight: '',
  FAVC: '',
  FCVC: '',
  NCP: '',
  CAEC: '',
  SMOKE: '',
  CH2O: '',
  SCC: '',
  FAF: '',
  TUE: '',
  CALC: '',
  MTRANS: '',
}

const NUMERIC_FIELDS = ['Age', 'Height', 'Weight', 'FCVC', 'NCP', 'CH2O', 'FAF', 'TUE']

const NUMERIC_RULES = {
  Age: { min: 10, max: 100, step: 1, unit: 'anos' },
  Height: { min: 1.2, max: 2.3, step: 0.01, unit: 'm' },
  Weight: { min: 30, max: 250, step: 0.1, unit: 'kg' },
  FCVC: { min: 1, max: 3, step: 0.1, unit: 'escala 1-3' },
  NCP: { min: 1, max: 6, step: 0.1, unit: 'refeições/dia' },
  CH2O: { min: 1, max: 3, step: 0.1, unit: 'escala 1-3' },
  FAF: { min: 0, max: 3, step: 0.1, unit: 'escala 0-3' },
  TUE: { min: 0, max: 2, step: 0.1, unit: 'escala 0-2' },
}

const SELECT_OPTIONS = {
  Gender: ['Male', 'Female'],
  family_history_with_overweight: ['yes', 'no'],
  FAVC: ['yes', 'no'],
  CAEC: ['no', 'Sometimes', 'Frequently', 'Always'],
  SMOKE: ['yes', 'no'],
  SCC: ['yes', 'no'],
  CALC: ['no', 'Sometimes', 'Frequently', 'Always'],
  MTRANS: ['Automobile', 'Bike', 'Motorbike', 'Public_Transportation', 'Walking'],
}

const FIELD_META = {
  Gender: {
    label: 'Gênero',
    description: 'Sexo biológico informado pela pessoa.',
  },
  Age: {
    label: 'Idade',
    description: 'Idade em anos (10 a 100).',
  },
  Height: {
    label: 'Altura',
    description: 'Altura em metros (1.20 a 2.30).',
  },
  Weight: {
    label: 'Peso',
    description: 'Peso em quilogramas (30 a 250 kg).',
  },
  family_history_with_overweight: {
    label: 'Histórico familiar de sobrepeso',
    description: 'Se há casos de sobrepeso na família.',
  },
  FAVC: {
    label: 'Consumo frequente de alimentos calóricos',
    description: 'Indica hábito frequente de alimentos de alta caloria.',
  },
  FCVC: {
    label: 'Frequência de consumo de vegetais',
    description: 'Escala de 1 a 3 para frequência de vegetais.',
  },
  NCP: {
    label: 'Número de refeições principais',
    description: 'Quantidade média de refeições principais por dia (1 a 6).',
  },
  CAEC: {
    label: 'Consumo de comida entre refeições',
    description: 'Frequência de lanches fora das refeições principais.',
  },
  SMOKE: {
    label: 'Fumante',
    description: 'Indica se a pessoa fuma.',
  },
  CH2O: {
    label: 'Consumo diário de água',
    description: 'Escala de 1 a 3 para consumo diário de água.',
  },
  SCC: {
    label: 'Controle de calorias',
    description: 'Se monitora calorias consumidas diariamente.',
  },
  FAF: {
    label: 'Frequência de atividade física',
    description: 'Escala de 0 a 3 para atividade física semanal.',
  },
  TUE: {
    label: 'Tempo em telas',
    description: 'Escala de 0 a 2 para tempo diário de telas.',
  },
  CALC: {
    label: 'Consumo de álcool',
    description: 'Frequência de consumo de bebidas alcoólicas.',
  },
  MTRANS: {
    label: 'Meio de transporte',
    description: 'Meio de transporte mais utilizado no dia a dia.',
  },
}

const OPTION_LABELS = {
  Gender: {
    Male: 'Masculino',
    Female: 'Feminino',
  },
  family_history_with_overweight: {
    yes: 'Sim',
    no: 'Não',
  },
  FAVC: {
    yes: 'Sim',
    no: 'Não',
  },
  CAEC: {
    no: 'Nunca',
    Sometimes: 'Às vezes',
    Frequently: 'Frequentemente',
    Always: 'Sempre',
  },
  SMOKE: {
    yes: 'Sim',
    no: 'Não',
  },
  SCC: {
    yes: 'Sim',
    no: 'Não',
  },
  CALC: {
    no: 'Nunca',
    Sometimes: 'Às vezes',
    Frequently: 'Frequentemente',
    Always: 'Sempre',
  },
  MTRANS: {
    Automobile: 'Carro',
    Bike: 'Bicicleta',
    Motorbike: 'Moto',
    Public_Transportation: 'Transporte público',
    Walking: 'Caminhada',
  },
}

const getFieldLabel = (key) => FIELD_META[key]?.label || key
const getFieldDescription = (key) => FIELD_META[key]?.description || ''
const getOptionLabel = (field, value) => OPTION_LABELS[field]?.[value] || value
const getNumericRule = (key) => NUMERIC_RULES[key]

const normalizeNumericInput = (value) => value.replace(',', '.')

const isNumericInputValue = (value) => /^\d*(\.\d*)?$/.test(value)

const toNumber = (value) => Number(normalizeNumericInput(String(value)))

const CLASS_UI = {
  Insufficient_Weight: {
    label: 'Peso Insuficiente',
    description: 'A classificação indica baixo peso.',
    card: 'border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50',
    badge: 'bg-sky-100 text-sky-700',
  },
  Normal_Weight: {
    label: 'Peso Normal',
    description: 'A classificação indica faixa de peso saudável.',
    card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  Overweight_Level_I: {
    label: 'Sobrepeso Nível I',
    description: 'A classificação indica sobrepeso inicial.',
    card: 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  Overweight_Level_II: {
    label: 'Sobrepeso Nível II',
    description: 'A classificação indica sobrepeso elevado.',
    card: 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50',
    badge: 'bg-orange-100 text-orange-700',
  },
  Obesity_Type_I: {
    label: 'Obesidade Tipo I',
    description: 'A classificação indica obesidade tipo I.',
    card: 'border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50',
    badge: 'bg-rose-100 text-rose-700',
  },
  Obesity_Type_II: {
    label: 'Obesidade Tipo II',
    description: 'A classificação indica obesidade tipo II.',
    card: 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50',
    badge: 'bg-fuchsia-100 text-fuchsia-700',
  },
  Obesity_Type_III: {
    label: 'Obesidade Tipo III',
    description: 'A classificação indica obesidade tipo III.',
    card: 'border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50',
    badge: 'bg-violet-100 text-violet-700',
  },
}

const DEFAULT_CLASS_UI = {
  label: 'Classe não identificada',
  description: 'Não foi possível mapear uma interface para esta classe.',
  card: 'border-zinc-200 bg-gradient-to-br from-zinc-50 to-slate-50',
  badge: 'bg-zinc-100 text-zinc-700',
}

const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`

const toLabel = (key) => key.replaceAll('_', ' ')

export default function Home() {
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [predictionResult, setPredictionResult] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const { showError, showSuccess, showAlert } = useAlert()
  const { isDark } = useTheme()

  const fields = useMemo(() => Object.keys(INITIAL_FORM), [])

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleNumericChange = (key, value) => {
    const normalized = normalizeNumericInput(value)

    if (normalized === '' || isNumericInputValue(normalized)) {
      setFormData((prev) => ({ ...prev, [key]: normalized }))
    }
  }

  const buildPayload = () => {
    const payload = { ...formData }

    for (const key of NUMERIC_FIELDS) {
      payload[key] = toNumber(payload[key])
    }

    return payload
  }

  const validateForm = () => {
    for (const key of fields) {
      if (formData[key] === '') {
        showAlert(`Preencha o campo: ${getFieldLabel(key)}`, { type: 'alert', title: 'Campo obrigatório' })
        return false
      }
    }

    for (const key of NUMERIC_FIELDS) {
      const value = toNumber(formData[key])

      if (Number.isNaN(value)) {
        showAlert(`Valor inválido no campo numérico: ${getFieldLabel(key)}`, { type: 'alert', title: 'Validação' })
        return false
      }

      const rule = getNumericRule(key)
      if (rule && (value < rule.min || value > rule.max)) {
        showAlert(`${getFieldLabel(key)} deve estar entre ${rule.min} e ${rule.max}.`, {
          type: 'alert',
          title: 'Faixa inválida',
        })
        return false
      }
    }

    return true
  }

  const getPendingRequirements = async () => {
    const pending = []

    const dataStatusResponse = await getDataStatus()
    const modelStatusResponse = await getModelStatus()

    const dataStatus = dataStatusResponse?.status || {}
    const modelStatus = modelStatusResponse?.status || {}

    Object.entries(dataStatus).forEach(([key, value]) => {
      if (value !== true) {
        pending.push(`data.${key}`)
      }
    })

    Object.entries(modelStatus).forEach(([key, value]) => {
      if (key === 'metrics') return
      if (key === 'evaluate') return
      if (value !== true) {
        pending.push(`model.${key}`)
      }
    })

    return pending
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setPredictionResult(null)
    setShowDetails(false)

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)

      const pending = await getPendingRequirements()
      if (pending.length > 0) {
        pending.forEach((item) => {
          showError(`Requisito pendente: ${item}. Faça esta etapa antes de usar /predict.`, {
            title: 'Pré-requisito não concluído',
            duration: 6000,
          })
        })
        return
      }

      const response = await predict(buildPayload())
      setPredictionResult(response)

      if (response?.error) {
        showError(response?.message || 'Falha no predict', { title: 'Erro no predict' })
      } else {
        showSuccess('Predict executado com sucesso', { title: 'Sucesso' })
      }
    } catch (error) {
      showError(error?.message || 'Erro ao realizar predict', {
        title: 'Erro',
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={`min-h-screen p-6 transition-colors ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      <div className={`mx-auto w-full max-w-5xl rounded-xl border p-6 shadow-sm transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
        <h1 className="mb-1 text-2xl font-bold">Predict</h1>
        <p className={`mb-6 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Preencha os dados abaixo para enviar para a rota de predict.</p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((key) => {
            const isNumeric = NUMERIC_FIELDS.includes(key)
            const options = SELECT_OPTIONS[key]
            const numericRule = getNumericRule(key)

            return (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{getFieldLabel(key)}</span>
                <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{getFieldDescription(key)}</span>

                {options ? (
                  <select
                    value={formData[key]}
                    onChange={(event) => handleChange(key, event.target.value)}
                    className={`rounded-lg border px-3 py-2 outline-none transition ${isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-100 focus:border-zinc-500' : 'border-zinc-300 bg-white text-zinc-900 focus:border-zinc-400'}`}>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {getOptionLabel(key, option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type={isNumeric ? 'text' : 'text'}
                      inputMode={isNumeric ? 'decimal' : undefined}
                      pattern={isNumeric ? '\\d*(\\.\\d*)?' : undefined}
                      min={isNumeric ? numericRule?.min : undefined}
                      max={isNumeric ? numericRule?.max : undefined}
                      step={isNumeric ? numericRule?.step : undefined}
                      value={formData[key]}
                      onChange={(event) => (isNumeric ? handleNumericChange(key, event.target.value) : handleChange(key, event.target.value))}
                      onKeyDown={
                        isNumeric
                          ? (event) => {
                              if (['e', 'E', '+', '-', ' '].includes(event.key)) {
                                event.preventDefault()
                              }
                            }
                          : undefined
                      }
                      className={`w-full rounded-lg border px-3 py-2 outline-none transition ${isNumeric ? 'pr-24' : ''} ${isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-100 focus:border-zinc-500' : 'border-zinc-300 bg-white text-zinc-900 focus:border-zinc-400'}`}
                      placeholder={isNumeric ? `${numericRule?.min ?? 0} - ${numericRule?.max ?? 100}` : `Digite ${getFieldLabel(key).toLowerCase()}`}
                    />

                    {isNumeric && numericRule?.unit ? (
                      <span
                        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-medium ${
                          isDark ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                        {numericRule.unit}
                      </span>
                    ) : null}
                  </div>
                )}
              </label>
            )
          })}

          <div className="md:col-span-2 mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-lg px-4 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-900 hover:bg-zinc-700'}`}>
              {isSubmitting ? 'Enviando...' : 'Fazer predict'}
            </button>

            <button
              type="button"
              onClick={() => setFormData(INITIAL_FORM)}
              disabled={isSubmitting}
              className={`rounded-lg border px-4 py-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}>
              Limpar
            </button>
          </div>
        </form>

        <section className={`mt-6 rounded-lg border p-4 transition-colors ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
          <h2 className="mb-2 text-sm font-semibold">Resultado do predict</h2>

          {!predictionResult ? (
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Sem resultado ainda.</p>
          ) : predictionResult?.error ? (
            <p className="text-sm text-red-700">{predictionResult?.message || 'Erro no predict'}</p>
          ) : (
            <div className="space-y-4">
              {(() => {
                const predictedClass = predictionResult?.predicted_class
                const classUi = CLASS_UI[predictedClass] || DEFAULT_CLASS_UI
                const probabilityEntries = Object.entries(predictionResult?.probabilities || {}).sort((a, b) => b[1] - a[1])
                const predictedProbability = predictionResult?.probabilities?.[predictedClass]

                return (
                  <>
                    <div className={`rounded-xl border p-4 shadow-sm ${classUi.card}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Classe prevista</p>
                          <h3 className="text-lg font-bold text-zinc-900">{classUi.label}</h3>
                          <p className="text-sm text-zinc-700">{classUi.description}</p>
                        </div>

                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classUi.badge}`}>{formatPercent(predictedProbability)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDetails((prev) => !prev)}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm transition hover:bg-zinc-100">
                      {showDetails ? 'Ocultar detalhes' : 'Expandir detalhes'}
                    </button>

                    {showDetails ? (
                      <div className="space-y-4 rounded-xl border bg-white p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-lg border bg-zinc-50 p-3">
                            <p className="text-xs text-zinc-500">Classe original</p>
                            <p className="text-sm font-semibold text-zinc-900">{predictedClass || 'N/A'}</p>
                          </div>

                          <div className="rounded-lg border bg-zinc-50 p-3">
                            <p className="text-xs text-zinc-500">Índice da classe</p>
                            <p className="text-sm font-semibold text-zinc-900">{predictionResult?.class_index ?? 'N/A'}</p>
                          </div>

                          <div className="rounded-lg border bg-zinc-50 p-3">
                            <p className="text-xs text-zinc-500">Status</p>
                            <p className="text-sm font-semibold text-emerald-700">Sucesso</p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-sm font-semibold text-zinc-800">Probabilidades por classe</p>
                          <div className="space-y-2">
                            {probabilityEntries.map(([name, value]) => (
                              <div key={name} className="rounded-lg border bg-zinc-50 p-2">
                                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                  <span className="font-medium text-zinc-700">{toLabel(name)}</span>
                                  <span className="font-semibold text-zinc-900">{formatPercent(value)}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                                  <div className="h-full rounded-full bg-zinc-900" style={{ width: formatPercent(value) }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )
              })()}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
