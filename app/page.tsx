'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  FiHome, FiPlus, FiEye, FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle,
  FiUser, FiTruck, FiDollarSign, FiFileText, FiSearch,
  FiCalendar, FiPhone, FiMail, FiMapPin, FiClock, FiAlertCircle,
  FiChevronDown, FiChevronRight, FiLoader, FiRefreshCw, FiSettings
} from 'react-icons/fi'

// ── Agent IDs ──
const LOAN_CALC_AGENT_ID = '69a03c4946d462ee9ae7050a'
const LOAN_SUBMIT_AGENT_ID = '69a03c49c5e9762927678a57'

// ── TypeScript Interfaces ──
interface CustomerDetails {
  name: string
  phone: string
  email: string
  address: string
  idType: string
}

interface VehicleInfo {
  vehicleType: 'New' | 'Second-hand'
  make: string
  model: string
  year: string
  dealerName: string
  vehicleValue: number
}

interface FinancialInfo {
  monthlyIncome: number
  existingEmis: number
  creditScoreRange: string
  employmentType: string
}

interface LoanPreferences {
  desiredLoanAmount: number
  preferredTenure: number
}

interface LoanOffer {
  customer_name: string
  vehicle_description: string
  vehicle_value: number
  down_payment: number
  down_payment_percentage: number
  eligible_loan_amount: number
  desired_loan_amount: number
  approved_loan_amount: number
  interest_rate: number
  tenure_months: number
  monthly_emi: number
  total_interest: number
  total_payable: number
  eligibility_status: string
  eligibility_reason: string
  income_to_emi_ratio: number
  summary: string
}

interface SubmissionResult {
  application_reference_id: string
  submission_timestamp: string
  status: string
  customer_name: string
  vehicle_description: string
  approved_loan_amount: number
  monthly_emi: number
  tenure_months: number
  confirmation_message: string
}

interface Application {
  id: string
  customer: CustomerDetails
  vehicle: VehicleInfo
  financial: FinancialInfo
  loanPreferences: LoanPreferences
  loanOffer?: LoanOffer
  submission?: SubmissionResult
  status: 'Draft' | 'Calculated' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected'
  createdAt: string
  updatedAt: string
}

type ScreenType = 'dashboard' | 'onboarding' | 'review' | 'detail' | 'confirmation'

// ── Helpers ──
function formatINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '\u20B90'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function generateId(): string {
  return 'APP-' + Math.random().toString(36).substring(2, 10).toUpperCase()
}

function extractAgentData(result: any): any {
  if (!result?.success) return null
  const r = result?.response?.result
  if (r && typeof r === 'object') return r
  if (typeof r === 'string') {
    try { return JSON.parse(r) } catch { return null }
  }
  return null
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ── Sample data ──
const SAMPLE_APPLICATIONS: Application[] = [
  {
    id: 'APP-DEMO001',
    customer: { name: 'Rajesh Kumar', phone: '9876543210', email: 'rajesh@example.com', address: '42, MG Road, Bengaluru', idType: 'Aadhaar' },
    vehicle: { vehicleType: 'New', make: 'Maruti Suzuki', model: 'Swift', year: '2025', dealerName: 'Nexa Showroom', vehicleValue: 850000 },
    financial: { monthlyIncome: 75000, existingEmis: 5000, creditScoreRange: '750-800', employmentType: 'Salaried' },
    loanPreferences: { desiredLoanAmount: 600000, preferredTenure: 60 },
    loanOffer: { customer_name: 'Rajesh Kumar', vehicle_description: 'New Maruti Suzuki Swift 2025', vehicle_value: 850000, down_payment: 255000, down_payment_percentage: 30, eligible_loan_amount: 595000, desired_loan_amount: 600000, approved_loan_amount: 595000, interest_rate: 8.5, tenure_months: 60, monthly_emi: 12197, total_interest: 136820, total_payable: 731820, eligibility_status: 'Eligible', eligibility_reason: 'Good income-to-EMI ratio and credit score', income_to_emi_ratio: 22.93, summary: 'Loan approved for Rajesh Kumar for New Maruti Suzuki Swift 2025.' },
    status: 'Submitted',
    createdAt: '2025-12-15T10:30:00Z',
    updatedAt: '2025-12-15T11:00:00Z',
    submission: { application_reference_id: 'VL-2025-0001', submission_timestamp: '2025-12-15T11:00:00Z', status: 'Submitted', customer_name: 'Rajesh Kumar', vehicle_description: 'New Maruti Suzuki Swift 2025', approved_loan_amount: 595000, monthly_emi: 12197, tenure_months: 60, confirmation_message: 'Application submitted successfully.' },
  },
  {
    id: 'APP-DEMO002',
    customer: { name: 'Priya Sharma', phone: '9123456789', email: 'priya@example.com', address: '15, Park Street, Kolkata', idType: 'PAN Card' },
    vehicle: { vehicleType: 'New', make: 'Hyundai', model: 'Creta', year: '2025', dealerName: 'Hyundai Hub', vehicleValue: 1450000 },
    financial: { monthlyIncome: 120000, existingEmis: 10000, creditScoreRange: 'Above 800', employmentType: 'Business Owner' },
    loanPreferences: { desiredLoanAmount: 1000000, preferredTenure: 48 },
    loanOffer: { customer_name: 'Priya Sharma', vehicle_description: 'New Hyundai Creta 2025', vehicle_value: 1450000, down_payment: 435000, down_payment_percentage: 30, eligible_loan_amount: 1015000, desired_loan_amount: 1000000, approved_loan_amount: 1000000, interest_rate: 7.5, tenure_months: 48, monthly_emi: 24178, total_interest: 160544, total_payable: 1160544, eligibility_status: 'Eligible', eligibility_reason: 'Excellent credit score and strong income', income_to_emi_ratio: 20.15, summary: 'Loan approved for Priya Sharma for New Hyundai Creta 2025.' },
    status: 'Calculated',
    createdAt: '2025-12-14T08:00:00Z',
    updatedAt: '2025-12-14T09:00:00Z',
  },
  {
    id: 'APP-DEMO003',
    customer: { name: 'Amit Patel', phone: '9988776655', email: 'amit@example.com', address: '7, SG Highway, Ahmedabad', idType: 'Driving License' },
    vehicle: { vehicleType: 'Second-hand', make: 'Honda', model: 'City', year: '2022', dealerName: 'TruValue Motors', vehicleValue: 750000 },
    financial: { monthlyIncome: 55000, existingEmis: 8000, creditScoreRange: '650-700', employmentType: 'Salaried' },
    loanPreferences: { desiredLoanAmount: 500000, preferredTenure: 36 },
    status: 'Draft',
    createdAt: '2025-12-13T14:00:00Z',
    updatedAt: '2025-12-13T14:00:00Z',
  },
]

// ── Validation ──
function validateStep(step: number, customer: CustomerDetails, vehicle: VehicleInfo, financial: FinancialInfo, loanPrefs: LoanPreferences): Record<string, string> {
  const errors: Record<string, string> = {}
  if (step === 1) {
    if (!customer.name.trim()) errors.name = 'Name is required'
    if (!customer.phone.trim()) errors.phone = 'Phone is required'
    else if (!/^\d{10}$/.test(customer.phone.trim())) errors.phone = 'Enter a valid 10-digit phone number'
    if (!customer.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) errors.email = 'Enter a valid email address'
    if (!customer.address.trim()) errors.address = 'Address is required'
    if (!customer.idType) errors.idType = 'Please select an ID type'
  }
  if (step === 2) {
    if (!vehicle.make) errors.make = 'Please select a vehicle make'
    if (!vehicle.model.trim()) errors.model = 'Model is required'
    if (!vehicle.year) errors.year = 'Please select a year'
    if (!vehicle.dealerName.trim()) errors.dealerName = 'Dealer name is required'
    if (!vehicle.vehicleValue || vehicle.vehicleValue <= 0) errors.vehicleValue = 'Enter a valid vehicle value'
  }
  if (step === 3) {
    if (!financial.monthlyIncome || financial.monthlyIncome <= 0) errors.monthlyIncome = 'Enter a valid monthly income'
    if (financial.existingEmis < 0) errors.existingEmis = 'Cannot be negative'
    if (!financial.creditScoreRange) errors.creditScoreRange = 'Please select a credit score range'
    if (!financial.employmentType) errors.employmentType = 'Please select an employment type'
  }
  if (step === 4) {
    if (!loanPrefs.desiredLoanAmount || loanPrefs.desiredLoanAmount <= 0) errors.desiredLoanAmount = 'Enter a valid loan amount'
    if (loanPrefs.desiredLoanAmount > 1000000) errors.desiredLoanAmount = 'Maximum loan amount is 10,00,000'
    if (!loanPrefs.preferredTenure) errors.preferredTenure = 'Please select a tenure'
  }
  return errors
}

// ── Status Badge ──
function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    Draft: 'bg-muted text-muted-foreground',
    Calculated: 'bg-amber-100 text-amber-800 border-amber-300',
    Submitted: 'bg-blue-100 text-blue-800 border-blue-300',
    'Under Review': 'bg-purple-100 text-purple-800 border-purple-300',
    Approved: 'bg-green-100 text-green-800 border-green-300',
    Rejected: 'bg-red-100 text-red-800 border-red-300',
    Eligible: 'bg-green-100 text-green-800 border-green-300',
    Adjusted: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Ineligible: 'bg-red-100 text-red-800 border-red-300',
  }
  const cls = colorMap[status] ?? 'bg-muted text-muted-foreground'
  return <Badge variant="outline" className={cls}>{status}</Badge>
}

// ── Step Indicator ──
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const labels = ['Customer', 'Vehicle', 'Financials', 'Loan', 'Review']
  const icons = [FiUser, FiTruck, FiDollarSign, FiFileText, FiCheck]
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {labels.map((label, idx) => {
        const step = idx + 1
        const IconComp = icons[idx]
        const isActive = step === currentStep
        const isComplete = step < currentStep
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${isComplete ? 'bg-primary text-primary-foreground' : isActive ? 'bg-accent text-accent-foreground ring-2 ring-accent ring-offset-2 ring-offset-background' : 'bg-muted text-muted-foreground'}`}>
                {isComplete ? <FiCheck className="w-5 h-5" /> : <IconComp className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-accent' : isComplete ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
            </div>
            {step < totalSteps && (
              <div className={`w-12 h-0.5 mb-5 rounded ${step < currentStep ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Info Row ──
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || '-'}</p>
      </div>
    </div>
  )
}

// ── Sidebar ──
function Sidebar({ currentScreen, onNavigate }: { currentScreen: ScreenType; onNavigate: (screen: ScreenType) => void }) {
  return (
    <div className="w-64 bg-card border-r border-border/30 flex flex-col min-h-screen">
      <div className="p-6 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <FiTruck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-foreground tracking-wide">VehicleLoan</h1>
            <p className="text-xs text-accent font-semibold tracking-widest uppercase">Pro</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <button onClick={() => onNavigate('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentScreen === 'dashboard' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}>
          <FiHome className="w-4 h-4" />
          Dashboard
        </button>
        <button onClick={() => onNavigate('onboarding')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentScreen === 'onboarding' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}>
          <FiPlus className="w-4 h-4" />
          New Application
        </button>
      </nav>
      <div className="p-4 border-t border-border/30">
        <Card className="bg-secondary/50 border-border/20">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><FiSettings className="w-3 h-3" /> Powered by AI</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Loan Calculator</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Loan Processor</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Currency Input ──
function CurrencyInput({ value, onChange, placeholder, id, hasError }: { value: number; onChange: (val: number) => void; placeholder?: string; id?: string; hasError?: boolean }) {
  const displayVal = value > 0 ? new Intl.NumberFormat('en-IN').format(value) : ''
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">{'\u20B9'}</span>
      <Input id={id} className={`pl-8 ${hasError ? 'border-destructive' : ''}`} placeholder={placeholder ?? '0'} value={displayVal} onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); onChange(raw ? parseInt(raw, 10) : 0) }} />
    </div>
  )
}

// ── ErrorBoundary ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ══════════════════════════════════════════════
// ══ MAIN PAGE COMPONENT ══
// ══════════════════════════════════════════════
export default function Page() {
  // ── State ──
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard')
  const [currentStep, setCurrentStep] = useState(1)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [showSampleData, setShowSampleData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [agentError, setAgentError] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // ── Form State ──
  const [customer, setCustomer] = useState<CustomerDetails>({ name: '', phone: '', email: '', address: '', idType: '' })
  const [vehicle, setVehicle] = useState<VehicleInfo>({ vehicleType: 'New', make: '', model: '', year: '', dealerName: '', vehicleValue: 0 })
  const [financial, setFinancial] = useState<FinancialInfo>({ monthlyIncome: 0, existingEmis: 0, creditScoreRange: '', employmentType: '' })
  const [loanPrefs, setLoanPrefs] = useState<LoanPreferences>({ desiredLoanAmount: 0, preferredTenure: 0 })
  const [loanOffer, setLoanOffer] = useState<LoanOffer | null>(null)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customer: true,
    vehicle: true,
    financial: true,
    loanOffer: true,
    submission: true,
  })

  // ── localStorage persistence ──
  useEffect(() => {
    const saved = localStorage.getItem('vehicleloan_applications')
    if (saved) {
      try { setApplications(JSON.parse(saved)) } catch {}
    }
  }, [])

  useEffect(() => {
    if (applications.length > 0) {
      localStorage.setItem('vehicleloan_applications', JSON.stringify(applications))
    }
  }, [applications])

  // ── Computed data ──
  const displayApps = showSampleData && applications.length === 0 ? SAMPLE_APPLICATIONS : applications
  const filteredApps = displayApps.filter(app => {
    const matchSearch = !searchQuery || app.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) || app.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || app.status === statusFilter
    return matchSearch && matchStatus
  })

  const statsTotal = displayApps.length
  const statsPending = displayApps.filter(a => a.status === 'Draft' || a.status === 'Calculated').length
  const statsSubmitted = displayApps.filter(a => a.status === 'Submitted' || a.status === 'Under Review').length
  const statsResolved = displayApps.filter(a => a.status === 'Approved' || a.status === 'Rejected').length

  const selectedApp = displayApps.find(a => a.id === selectedAppId)

  // ── Navigation ──
  const navigateTo = useCallback((screen: ScreenType) => {
    setCurrentScreen(screen)
    setAgentError(null)
    if (screen === 'onboarding') {
      setCurrentStep(1)
      setCustomer({ name: '', phone: '', email: '', address: '', idType: '' })
      setVehicle({ vehicleType: 'New', make: '', model: '', year: '', dealerName: '', vehicleValue: 0 })
      setFinancial({ monthlyIncome: 0, existingEmis: 0, creditScoreRange: '', employmentType: '' })
      setLoanPrefs({ desiredLoanAmount: 0, preferredTenure: 0 })
      setLoanOffer(null)
      setSubmissionResult(null)
      setErrors({})
    }
  }, [])

  // ── Step Navigation ──
  const handleNext = () => {
    const stepErrors = validateStep(currentStep, customer, vehicle, financial, loanPrefs)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setCurrentStep(prev => Math.min(prev + 1, 5))
  }

  const handleBack = () => {
    setErrors({})
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // ── Calculate Loan Offer (Agent 1) ──
  const handleCalculate = async () => {
    setIsCalculating(true)
    setAgentError(null)
    setActiveAgentId(LOAN_CALC_AGENT_ID)
    try {
      const message = JSON.stringify({
        customer_name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        id_type: customer.idType,
        vehicle_type: vehicle.vehicleType,
        vehicle_make: vehicle.make,
        vehicle_model: vehicle.model,
        vehicle_year: vehicle.year,
        dealer_name: vehicle.dealerName,
        vehicle_value: vehicle.vehicleValue,
        monthly_income: financial.monthlyIncome,
        existing_emis: financial.existingEmis,
        credit_score_range: financial.creditScoreRange,
        employment_type: financial.employmentType,
        desired_loan_amount: loanPrefs.desiredLoanAmount,
        preferred_tenure_months: loanPrefs.preferredTenure,
      })
      const result = await callAIAgent(message, LOAN_CALC_AGENT_ID)
      const data = extractAgentData(result)
      if (data) {
        const offer: LoanOffer = {
          customer_name: data?.customer_name ?? customer.name,
          vehicle_description: data?.vehicle_description ?? `${vehicle.vehicleType} ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
          vehicle_value: data?.vehicle_value ?? vehicle.vehicleValue,
          down_payment: data?.down_payment ?? 0,
          down_payment_percentage: data?.down_payment_percentage ?? 0,
          eligible_loan_amount: data?.eligible_loan_amount ?? 0,
          desired_loan_amount: data?.desired_loan_amount ?? loanPrefs.desiredLoanAmount,
          approved_loan_amount: data?.approved_loan_amount ?? 0,
          interest_rate: data?.interest_rate ?? 0,
          tenure_months: data?.tenure_months ?? loanPrefs.preferredTenure,
          monthly_emi: data?.monthly_emi ?? 0,
          total_interest: data?.total_interest ?? 0,
          total_payable: data?.total_payable ?? 0,
          eligibility_status: data?.eligibility_status ?? 'Unknown',
          eligibility_reason: data?.eligibility_reason ?? '',
          income_to_emi_ratio: data?.income_to_emi_ratio ?? 0,
          summary: data?.summary ?? '',
        }
        setLoanOffer(offer)
        // Save as application
        const app: Application = {
          id: generateId(),
          customer,
          vehicle,
          financial,
          loanPreferences: loanPrefs,
          loanOffer: offer,
          status: 'Calculated',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setApplications(prev => [app, ...prev])
        setSelectedAppId(app.id)
        setCurrentScreen('review')
      } else {
        setAgentError(result?.error ?? result?.response?.message ?? 'Failed to calculate loan offer. Please try again.')
      }
    } catch (err: any) {
      setAgentError(err?.message ?? 'An unexpected error occurred.')
    } finally {
      setIsCalculating(false)
      setActiveAgentId(null)
    }
  }

  // ── Submit Application (Agent 2) ──
  const handleSubmit = async () => {
    if (!loanOffer) return
    setIsSubmitting(true)
    setAgentError(null)
    setActiveAgentId(LOAN_SUBMIT_AGENT_ID)
    try {
      const message = JSON.stringify({
        customer_name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        id_type: customer.idType,
        vehicle_type: vehicle.vehicleType,
        vehicle_make: vehicle.make,
        vehicle_model: vehicle.model,
        vehicle_year: vehicle.year,
        dealer_name: vehicle.dealerName,
        vehicle_value: vehicle.vehicleValue,
        monthly_income: financial.monthlyIncome,
        existing_emis: financial.existingEmis,
        credit_score_range: financial.creditScoreRange,
        employment_type: financial.employmentType,
        loan_offer: loanOffer,
      })
      const result = await callAIAgent(message, LOAN_SUBMIT_AGENT_ID)
      const data = extractAgentData(result)
      if (data) {
        const sub: SubmissionResult = {
          application_reference_id: data?.application_reference_id ?? '-',
          submission_timestamp: data?.submission_timestamp ?? new Date().toISOString(),
          status: data?.status ?? 'Submitted',
          customer_name: data?.customer_name ?? customer.name,
          vehicle_description: data?.vehicle_description ?? loanOffer?.vehicle_description ?? '',
          approved_loan_amount: data?.approved_loan_amount ?? loanOffer?.approved_loan_amount ?? 0,
          monthly_emi: data?.monthly_emi ?? loanOffer?.monthly_emi ?? 0,
          tenure_months: data?.tenure_months ?? loanOffer?.tenure_months ?? 0,
          confirmation_message: data?.confirmation_message ?? 'Application submitted successfully.',
        }
        setSubmissionResult(sub)
        // Update the application in state
        setApplications(prev => prev.map(app => app.id === selectedAppId ? { ...app, submission: sub, status: 'Submitted' as const, updatedAt: new Date().toISOString() } : app))
        setCurrentScreen('confirmation')
      } else {
        setAgentError(result?.error ?? result?.response?.message ?? 'Failed to submit application. Please try again.')
      }
    } catch (err: any) {
      setAgentError(err?.message ?? 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
      setActiveAgentId(null)
    }
  }

  // ══════════════════════
  // ══ DASHBOARD SCREEN ══
  // ══════════════════════
  function DashboardScreen() {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground tracking-wide">Dashboard</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your vehicle loan applications</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Sample Data</Label>
                <Switch id="sample-toggle" checked={showSampleData} onCheckedChange={setShowSampleData} />
              </div>
              <Button onClick={() => navigateTo('onboarding')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <FiPlus className="w-4 h-4 mr-2" />
                New Application
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card border-border/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                    <p className="text-3xl font-bold font-serif text-foreground mt-1">{statsTotal}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FiFileText className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                    <p className="text-3xl font-bold font-serif text-foreground mt-1">{statsPending}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <FiClock className="w-6 h-6 text-amber-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Submitted</p>
                    <p className="text-3xl font-bold font-serif text-foreground mt-1">{statsSubmitted}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FiCheckCircle className="w-6 h-6 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Resolved</p>
                    <p className="text-3xl font-bold font-serif text-foreground mt-1">{statsResolved}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <FiCheck className="w-6 h-6 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <Card className="bg-card border-border/30 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by name, model, or ID..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Calculated">Calculated</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Applications Table */}
          <Card className="bg-card border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">Applications</CardTitle>
              <CardDescription>{filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''} found</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredApps.length === 0 ? (
                <div className="text-center py-16">
                  <FiFileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-2">No Applications Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Start by creating a new vehicle loan application or enable Sample Data to explore.</p>
                  <Button onClick={() => navigateTo('onboarding')} className="bg-primary text-primary-foreground">
                    <FiPlus className="w-4 h-4 mr-2" /> Create First Application
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead className="text-right">Loan Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApps.map((app) => (
                        <TableRow key={app.id} className="hover:bg-secondary/30 cursor-pointer">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{app.customer.name}</p>
                              <p className="text-xs text-muted-foreground">{app.id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{app.vehicle.make} {app.vehicle.model}</p>
                              <p className="text-xs text-muted-foreground">{app.vehicle.vehicleType} - {app.vehicle.year}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatINR(app.loanOffer?.approved_loan_amount ?? app.loanPreferences.desiredLoanAmount)}</TableCell>
                          <TableCell><StatusBadge status={app.status} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => { setSelectedAppId(app.id); setCurrentScreen('detail') }}>
                              <FiEye className="w-3 h-3 mr-1" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ══════════════════════════
  // ══ ONBOARDING SCREEN ══
  // ══════════════════════════
  function OnboardingScreen() {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigateTo('dashboard')} className="text-muted-foreground mb-4">
              <FiArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
            <h2 className="font-serif text-2xl font-bold text-foreground tracking-wide">New Loan Application</h2>
            <p className="text-sm text-muted-foreground mt-1">Complete each step to get your personalized loan offer</p>
          </div>

          {/* Step Progress */}
          <StepIndicator currentStep={currentStep} totalSteps={5} />
          <Progress value={(currentStep / 5) * 100} className="mb-8 h-2" />

          {/* Step Content */}
          <Card className="bg-card border-border/30">
            <CardContent className="p-6">
              {/* ── Step 1: Customer Details ── */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><FiUser className="w-5 h-5 text-primary" /> Customer Details</h3>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="cust-name">Full Name *</Label>
                      <Input id="cust-name" placeholder="Enter full name" value={customer.name} onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))} className={errors.name ? 'border-destructive' : ''} />
                      {errors.name && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cust-phone">Phone Number *</Label>
                      <div className="relative">
                        <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="cust-phone" placeholder="10-digit phone" className={`pl-10 ${errors.phone ? 'border-destructive' : ''}`} value={customer.phone} onChange={(e) => setCustomer(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                      </div>
                      {errors.phone && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cust-email">Email Address *</Label>
                      <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="cust-email" type="email" placeholder="email@example.com" className={`pl-10 ${errors.email ? 'border-destructive' : ''}`} value={customer.email} onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))} />
                      </div>
                      {errors.email && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cust-id">ID Type *</Label>
                      <Select value={customer.idType} onValueChange={(val) => setCustomer(prev => ({ ...prev, idType: val }))}>
                        <SelectTrigger className={errors.idType ? 'border-destructive' : ''}><SelectValue placeholder="Select ID type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Aadhaar">Aadhaar</SelectItem>
                          <SelectItem value="PAN Card">PAN Card</SelectItem>
                          <SelectItem value="Voter ID">Voter ID</SelectItem>
                          <SelectItem value="Driving License">Driving License</SelectItem>
                          <SelectItem value="Passport">Passport</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.idType && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.idType}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cust-address">Address *</Label>
                    <div className="relative">
                      <FiMapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Textarea id="cust-address" placeholder="Full address" className={`pl-10 ${errors.address ? 'border-destructive' : ''}`} value={customer.address} onChange={(e) => setCustomer(prev => ({ ...prev, address: e.target.value }))} rows={3} />
                    </div>
                    {errors.address && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.address}</p>}
                  </div>
                </div>
              )}

              {/* ── Step 2: Vehicle Information ── */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><FiTruck className="w-5 h-5 text-primary" /> Vehicle Information</h3>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Vehicle Type</Label>
                    <div className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg">
                      <button onClick={() => setVehicle(prev => ({ ...prev, vehicleType: 'New' }))} className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${vehicle.vehicleType === 'New' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}>New</button>
                      <button onClick={() => setVehicle(prev => ({ ...prev, vehicleType: 'Second-hand' }))} className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${vehicle.vehicleType === 'Second-hand' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}>Second-hand</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="veh-make">Make *</Label>
                      <Select value={vehicle.make} onValueChange={(val) => setVehicle(prev => ({ ...prev, make: val }))}>
                        <SelectTrigger className={errors.make ? 'border-destructive' : ''}><SelectValue placeholder="Select make" /></SelectTrigger>
                        <SelectContent>
                          {['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota', 'Kia', 'MG', 'Skoda', 'Volkswagen'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {errors.make && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.make}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="veh-model">Model *</Label>
                      <Input id="veh-model" placeholder="e.g. Swift, Creta" value={vehicle.model} onChange={(e) => setVehicle(prev => ({ ...prev, model: e.target.value }))} className={errors.model ? 'border-destructive' : ''} />
                      {errors.model && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.model}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="veh-year">Year *</Label>
                      <Select value={vehicle.year} onValueChange={(val) => setVehicle(prev => ({ ...prev, year: val }))}>
                        <SelectTrigger className={errors.year ? 'border-destructive' : ''}><SelectValue placeholder="Select year" /></SelectTrigger>
                        <SelectContent>
                          {['2026', '2025', '2024', '2023', '2022', '2021', '2020'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {errors.year && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.year}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="veh-dealer">Dealer Name *</Label>
                      <Input id="veh-dealer" placeholder="Dealer or showroom name" value={vehicle.dealerName} onChange={(e) => setVehicle(prev => ({ ...prev, dealerName: e.target.value }))} className={errors.dealerName ? 'border-destructive' : ''} />
                      {errors.dealerName && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.dealerName}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="veh-value">Vehicle Value (INR) *</Label>
                    <CurrencyInput value={vehicle.vehicleValue} onChange={(val) => setVehicle(prev => ({ ...prev, vehicleValue: val }))} placeholder="e.g. 8,50,000" id="veh-value" hasError={!!errors.vehicleValue} />
                    {errors.vehicleValue && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.vehicleValue}</p>}
                  </div>
                </div>
              )}

              {/* ── Step 3: Financial Information ── */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><FiDollarSign className="w-5 h-5 text-primary" /> Financial Information</h3>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="fin-income">Monthly Income (INR) *</Label>
                      <CurrencyInput value={financial.monthlyIncome} onChange={(val) => setFinancial(prev => ({ ...prev, monthlyIncome: val }))} placeholder="e.g. 75,000" id="fin-income" hasError={!!errors.monthlyIncome} />
                      {errors.monthlyIncome && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.monthlyIncome}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fin-emis">Existing EMIs (INR)</Label>
                      <CurrencyInput value={financial.existingEmis} onChange={(val) => setFinancial(prev => ({ ...prev, existingEmis: val }))} placeholder="0" id="fin-emis" hasError={!!errors.existingEmis} />
                      {errors.existingEmis && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.existingEmis}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fin-credit">Credit Score Range *</Label>
                      <Select value={financial.creditScoreRange} onValueChange={(val) => setFinancial(prev => ({ ...prev, creditScoreRange: val }))}>
                        <SelectTrigger className={errors.creditScoreRange ? 'border-destructive' : ''}><SelectValue placeholder="Select range" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Below 600">Below 600</SelectItem>
                          <SelectItem value="600-650">600-650</SelectItem>
                          <SelectItem value="650-700">650-700</SelectItem>
                          <SelectItem value="700-750">700-750</SelectItem>
                          <SelectItem value="750-800">750-800</SelectItem>
                          <SelectItem value="Above 800">Above 800</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.creditScoreRange && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.creditScoreRange}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fin-emp">Employment Type *</Label>
                      <Select value={financial.employmentType} onValueChange={(val) => setFinancial(prev => ({ ...prev, employmentType: val }))}>
                        <SelectTrigger className={errors.employmentType ? 'border-destructive' : ''}><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Salaried">Salaried</SelectItem>
                          <SelectItem value="Self-employed">Self-employed</SelectItem>
                          <SelectItem value="Business Owner">Business Owner</SelectItem>
                          <SelectItem value="Professional">Professional</SelectItem>
                          <SelectItem value="Government Employee">Government Employee</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.employmentType && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.employmentType}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Loan Preferences ── */}
              {currentStep === 4 && (
                <div className="space-y-5">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><FiFileText className="w-5 h-5 text-primary" /> Loan Preferences</h3>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="loan-amount">Desired Loan Amount (INR) *</Label>
                      <CurrencyInput value={loanPrefs.desiredLoanAmount} onChange={(val) => setLoanPrefs(prev => ({ ...prev, desiredLoanAmount: val }))} placeholder="e.g. 6,00,000" id="loan-amount" hasError={!!errors.desiredLoanAmount} />
                      <p className="text-xs text-muted-foreground">Max: {'\u20B9'}10,00,000</p>
                      {errors.desiredLoanAmount && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.desiredLoanAmount}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loan-tenure">Preferred Tenure *</Label>
                      <Select value={loanPrefs.preferredTenure ? String(loanPrefs.preferredTenure) : ''} onValueChange={(val) => setLoanPrefs(prev => ({ ...prev, preferredTenure: parseInt(val, 10) }))}>
                        <SelectTrigger className={errors.preferredTenure ? 'border-destructive' : ''}><SelectValue placeholder="Select tenure" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 months (1 year)</SelectItem>
                          <SelectItem value="24">24 months (2 years)</SelectItem>
                          <SelectItem value="36">36 months (3 years)</SelectItem>
                          <SelectItem value="48">48 months (4 years)</SelectItem>
                          <SelectItem value="60">60 months (5 years)</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.preferredTenure && <p className="text-xs text-destructive flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errors.preferredTenure}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 5: Review ── */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><FiCheck className="w-5 h-5 text-primary" /> Review Your Application</h3>
                  <Separator />

                  {/* Customer Summary */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2"><FiUser className="w-4 h-4" /> Customer Details</h4>
                    <div className="bg-secondary/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-1">
                      <InfoRow icon={<FiUser className="w-4 h-4" />} label="Name" value={customer.name} />
                      <InfoRow icon={<FiPhone className="w-4 h-4" />} label="Phone" value={customer.phone} />
                      <InfoRow icon={<FiMail className="w-4 h-4" />} label="Email" value={customer.email} />
                      <InfoRow icon={<FiFileText className="w-4 h-4" />} label="ID Type" value={customer.idType} />
                      <div className="md:col-span-2">
                        <InfoRow icon={<FiMapPin className="w-4 h-4" />} label="Address" value={customer.address} />
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Summary */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2"><FiTruck className="w-4 h-4" /> Vehicle Information</h4>
                    <div className="bg-secondary/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-1">
                      <InfoRow icon={<FiTruck className="w-4 h-4" />} label="Type" value={vehicle.vehicleType} />
                      <InfoRow icon={<FiTruck className="w-4 h-4" />} label="Make & Model" value={`${vehicle.make} ${vehicle.model}`} />
                      <InfoRow icon={<FiCalendar className="w-4 h-4" />} label="Year" value={vehicle.year} />
                      <InfoRow icon={<FiHome className="w-4 h-4" />} label="Dealer" value={vehicle.dealerName} />
                      <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Vehicle Value" value={formatINR(vehicle.vehicleValue)} />
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2"><FiDollarSign className="w-4 h-4" /> Financial Details</h4>
                    <div className="bg-secondary/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-1">
                      <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Monthly Income" value={formatINR(financial.monthlyIncome)} />
                      <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Existing EMIs" value={formatINR(financial.existingEmis)} />
                      <InfoRow icon={<FiFileText className="w-4 h-4" />} label="Credit Score" value={financial.creditScoreRange} />
                      <InfoRow icon={<FiUser className="w-4 h-4" />} label="Employment" value={financial.employmentType} />
                    </div>
                  </div>

                  {/* Loan Preferences Summary */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2"><FiFileText className="w-4 h-4" /> Loan Preferences</h4>
                    <div className="bg-secondary/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-1">
                      <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Desired Loan Amount" value={formatINR(loanPrefs.desiredLoanAmount)} />
                      <InfoRow icon={<FiCalendar className="w-4 h-4" />} label="Preferred Tenure" value={`${loanPrefs.preferredTenure} months`} />
                    </div>
                  </div>

                  {/* Agent Error */}
                  {agentError && (
                    <Card className="border-destructive bg-destructive/5">
                      <CardContent className="p-4 flex items-start gap-3">
                        <FiAlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-destructive">Calculation Error</p>
                          <p className="text-xs text-destructive/80 mt-1">{agentError}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleCalculate} className="flex-shrink-0">
                          <FiRefreshCw className="w-3 h-3 mr-1" /> Retry
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={currentStep === 1 ? () => navigateTo('dashboard') : handleBack} className="gap-2">
              <FiArrowLeft className="w-4 h-4" />
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>
            {currentStep < 5 ? (
              <Button onClick={handleNext} className="bg-primary text-primary-foreground gap-2">
                Next <FiArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleCalculate} disabled={isCalculating} className="bg-accent text-accent-foreground gap-2 min-w-[200px]">
                {isCalculating ? (
                  <><FiLoader className="w-4 h-4 animate-spin" /> Calculating...</>
                ) : (
                  <><FiDollarSign className="w-4 h-4" /> Calculate Loan Offer</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════
  // ══ REVIEW SCREEN ══
  // ══════════════════════
  function ReviewScreen() {
    if (!loanOffer) return null
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          <Button variant="ghost" size="sm" onClick={() => navigateTo('dashboard')} className="text-muted-foreground mb-4">
            <FiArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground tracking-wide">Loan Offer</h2>
              <p className="text-sm text-muted-foreground mt-1">Review your personalized loan offer below</p>
            </div>
            <StatusBadge status={loanOffer?.eligibility_status ?? 'Unknown'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Customer & Vehicle */}
            <div className="space-y-6">
              <Card className="bg-card border-border/30">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2"><FiUser className="w-4 h-4 text-primary" /> Customer Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow icon={<FiUser className="w-4 h-4" />} label="Name" value={loanOffer?.customer_name ?? customer.name} />
                  <InfoRow icon={<FiPhone className="w-4 h-4" />} label="Phone" value={customer.phone} />
                  <InfoRow icon={<FiMail className="w-4 h-4" />} label="Email" value={customer.email} />
                </CardContent>
              </Card>

              <Card className="bg-card border-border/30">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2"><FiTruck className="w-4 h-4 text-primary" /> Vehicle Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow icon={<FiTruck className="w-4 h-4" />} label="Vehicle" value={loanOffer?.vehicle_description ?? ''} />
                  <InfoRow icon={<FiHome className="w-4 h-4" />} label="Dealer" value={vehicle.dealerName} />
                  <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Monthly Income" value={formatINR(financial.monthlyIncome)} />
                  <InfoRow icon={<FiUser className="w-4 h-4" />} label="Employment" value={financial.employmentType} />
                </CardContent>
              </Card>

              {/* Eligibility Reason */}
              {loanOffer?.eligibility_reason && (
                <Card className="bg-card border-border/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-base flex items-center gap-2"><FiCheckCircle className="w-4 h-4 text-primary" /> Eligibility Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground">{loanOffer.eligibility_reason}</p>
                    {(loanOffer?.income_to_emi_ratio ?? 0) > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline" className="bg-secondary/50">Income-to-EMI Ratio: {loanOffer.income_to_emi_ratio?.toFixed(1) ?? '0'}%</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Summary */}
              {loanOffer?.summary && (
                <Card className="bg-card border-border/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-base flex items-center gap-2"><FiFileText className="w-4 h-4 text-primary" /> Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderMarkdown(loanOffer.summary)}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Loan Breakdown */}
            <div className="space-y-6">
              <Card className="bg-card border-border/30 border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2"><FiDollarSign className="w-4 h-4 text-primary" /> Loan Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Vehicle Value</span>
                      <span className="text-sm font-medium">{formatINR(loanOffer?.vehicle_value)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Down Payment ({loanOffer?.down_payment_percentage ?? 0}%)</span>
                      <span className="text-sm font-medium">{formatINR(loanOffer?.down_payment)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Eligible Loan Amount</span>
                      <span className="text-sm font-medium">{formatINR(loanOffer?.eligible_loan_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Desired Loan Amount</span>
                      <span className="text-sm font-medium">{formatINR(loanOffer?.desired_loan_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 bg-primary/5 rounded-lg px-3 -mx-1">
                      <span className="text-sm font-semibold text-primary">Approved Loan Amount</span>
                      <span className="text-lg font-bold text-primary">{formatINR(loanOffer?.approved_loan_amount)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Interest Rate</span>
                      <span className="text-sm font-medium">{loanOffer?.interest_rate ?? 0}% p.a.</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Tenure</span>
                      <span className="text-sm font-medium">{loanOffer?.tenure_months ?? 0} months</span>
                    </div>
                    <Separator />
                  </div>

                  {/* EMI Highlight */}
                  <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly EMI</p>
                    <p className="text-3xl font-bold font-serif text-accent">{formatINR(loanOffer?.monthly_emi)}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Total Interest Payable</span>
                      <span className="text-sm font-medium">{formatINR(loanOffer?.total_interest)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Total Amount Payable</span>
                      <span className="text-sm font-semibold">{formatINR(loanOffer?.total_payable)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Error */}
              {agentError && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <FiAlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">Submission Error</p>
                      <p className="text-xs text-destructive/80 mt-1">{agentError}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSubmit} className="flex-shrink-0">
                      <FiRefreshCw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setCurrentStep(1); setCurrentScreen('onboarding') }} className="flex-1 gap-2">
                  <FiArrowLeft className="w-4 h-4" /> Edit Application
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-accent text-accent-foreground gap-2">
                  {isSubmitting ? (
                    <><FiLoader className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><FiCheckCircle className="w-4 h-4" /> Submit to Processing</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════
  // ══ CONFIRMATION SCREEN ══
  // ══════════════════════════════
  function ConfirmationScreen() {
    if (!submissionResult) return null
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 flex flex-col items-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 shadow-lg">
            <FiCheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h2 className="font-serif text-2xl font-bold text-foreground tracking-wide mb-2">Application Submitted!</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">Your vehicle loan application has been successfully submitted for processing.</p>

          <Card className="bg-card border-border/30 w-full mb-6">
            <CardContent className="p-6 space-y-4">
              {/* Reference ID */}
              <div className="text-center pb-4 border-b border-border/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Application Reference ID</p>
                <p className="text-2xl font-bold font-serif text-primary">{submissionResult?.application_reference_id ?? '-'}</p>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={<FiUser className="w-4 h-4" />} label="Customer" value={submissionResult?.customer_name ?? ''} />
                <InfoRow icon={<FiTruck className="w-4 h-4" />} label="Vehicle" value={submissionResult?.vehicle_description ?? ''} />
                <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Approved Amount" value={formatINR(submissionResult?.approved_loan_amount)} />
                <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Monthly EMI" value={formatINR(submissionResult?.monthly_emi)} />
                <InfoRow icon={<FiCalendar className="w-4 h-4" />} label="Tenure" value={`${submissionResult?.tenure_months ?? 0} months`} />
                <InfoRow icon={<FiClock className="w-4 h-4" />} label="Submitted" value={formatDate(submissionResult?.submission_timestamp ?? '')} />
              </div>

              {/* Status */}
              <div className="flex items-center justify-center pt-2">
                <StatusBadge status={submissionResult?.status ?? 'Submitted'} />
              </div>

              {/* Confirmation Message */}
              {submissionResult?.confirmation_message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-green-800">{submissionResult.confirmation_message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={() => navigateTo('dashboard')} className="bg-primary text-primary-foreground gap-2">
            <FiHome className="w-4 h-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════
  // ══ APPLICATION DETAIL SCREEN ══
  // ══════════════════════════════
  function DetailScreen() {
    const app = selectedApp
    if (!app) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FiAlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Application not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigateTo('dashboard')}>
              <FiArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </div>
      )
    }

    const toggleSection = (key: string) => {
      setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
    }

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <Button variant="ghost" size="sm" onClick={() => navigateTo('dashboard')} className="text-muted-foreground mb-4">
            <FiArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground tracking-wide">{app.customer.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{app.id} &middot; {formatDate(app.createdAt)}</p>
            </div>
            <StatusBadge status={app.status} />
          </div>

          <div className="space-y-4">
            {/* Customer Info */}
            <Card className="bg-card border-border/30">
              <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggleSection('customer')}>
                <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2"><FiUser className="w-4 h-4 text-primary" /> Customer Information</h3>
                {expandedSections.customer ? <FiChevronDown className="w-4 h-4 text-muted-foreground" /> : <FiChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedSections.customer && (
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <InfoRow icon={<FiUser className="w-4 h-4" />} label="Name" value={app.customer.name} />
                    <InfoRow icon={<FiPhone className="w-4 h-4" />} label="Phone" value={app.customer.phone} />
                    <InfoRow icon={<FiMail className="w-4 h-4" />} label="Email" value={app.customer.email} />
                    <InfoRow icon={<FiFileText className="w-4 h-4" />} label="ID Type" value={app.customer.idType} />
                    <div className="md:col-span-2">
                      <InfoRow icon={<FiMapPin className="w-4 h-4" />} label="Address" value={app.customer.address} />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Vehicle Info */}
            <Card className="bg-card border-border/30">
              <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggleSection('vehicle')}>
                <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2"><FiTruck className="w-4 h-4 text-primary" /> Vehicle Information</h3>
                {expandedSections.vehicle ? <FiChevronDown className="w-4 h-4 text-muted-foreground" /> : <FiChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedSections.vehicle && (
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <InfoRow icon={<FiTruck className="w-4 h-4" />} label="Type" value={app.vehicle.vehicleType} />
                    <InfoRow icon={<FiTruck className="w-4 h-4" />} label="Make & Model" value={`${app.vehicle.make} ${app.vehicle.model}`} />
                    <InfoRow icon={<FiCalendar className="w-4 h-4" />} label="Year" value={app.vehicle.year} />
                    <InfoRow icon={<FiHome className="w-4 h-4" />} label="Dealer" value={app.vehicle.dealerName} />
                    <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Vehicle Value" value={formatINR(app.vehicle.vehicleValue)} />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Financial Info */}
            <Card className="bg-card border-border/30">
              <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggleSection('financial')}>
                <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2"><FiDollarSign className="w-4 h-4 text-primary" /> Financial Details</h3>
                {expandedSections.financial ? <FiChevronDown className="w-4 h-4 text-muted-foreground" /> : <FiChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedSections.financial && (
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Monthly Income" value={formatINR(app.financial.monthlyIncome)} />
                    <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Existing EMIs" value={formatINR(app.financial.existingEmis)} />
                    <InfoRow icon={<FiFileText className="w-4 h-4" />} label="Credit Score" value={app.financial.creditScoreRange} />
                    <InfoRow icon={<FiUser className="w-4 h-4" />} label="Employment" value={app.financial.employmentType} />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Loan Offer */}
            {app.loanOffer && (
              <Card className="bg-card border-border/30 border-2 border-primary/20">
                <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggleSection('loanOffer')}>
                  <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2"><FiDollarSign className="w-4 h-4 text-primary" /> Loan Offer</h3>
                  {expandedSections.loanOffer ? <FiChevronDown className="w-4 h-4 text-muted-foreground" /> : <FiChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedSections.loanOffer && (
                  <CardContent className="pt-0 pb-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Vehicle Value</span>
                        <span className="text-sm font-medium">{formatINR(app.loanOffer?.vehicle_value)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Down Payment ({app.loanOffer?.down_payment_percentage ?? 0}%)</span>
                        <span className="text-sm font-medium">{formatINR(app.loanOffer?.down_payment)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Approved Amount</span>
                        <span className="text-sm font-bold text-primary">{formatINR(app.loanOffer?.approved_loan_amount)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Interest Rate</span>
                        <span className="text-sm font-medium">{app.loanOffer?.interest_rate ?? 0}% p.a.</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Tenure</span>
                        <span className="text-sm font-medium">{app.loanOffer?.tenure_months ?? 0} months</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Monthly EMI</span>
                        <span className="text-sm font-bold text-accent">{formatINR(app.loanOffer?.monthly_emi)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Total Interest</span>
                        <span className="text-sm font-medium">{formatINR(app.loanOffer?.total_interest)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">Total Payable</span>
                        <span className="text-sm font-medium">{formatINR(app.loanOffer?.total_payable)}</span>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={app.loanOffer?.eligibility_status ?? 'Unknown'} />
                      {(app.loanOffer?.income_to_emi_ratio ?? 0) > 0 && (
                        <Badge variant="outline" className="bg-secondary/50 text-xs">EMI Ratio: {app.loanOffer?.income_to_emi_ratio?.toFixed(1)}%</Badge>
                      )}
                    </div>
                    {app.loanOffer?.eligibility_reason && (
                      <p className="text-sm text-muted-foreground mt-1">{app.loanOffer.eligibility_reason}</p>
                    )}
                    {app.loanOffer?.summary && (
                      <div className="mt-3 bg-secondary/30 p-3 rounded-lg">
                        {renderMarkdown(app.loanOffer.summary)}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Submission */}
            {app.submission && (
              <Card className="bg-card border-border/30">
                <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => toggleSection('submission')}>
                  <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2"><FiCheckCircle className="w-4 h-4 text-green-600" /> Submission Details</h3>
                  {expandedSections.submission ? <FiChevronDown className="w-4 h-4 text-muted-foreground" /> : <FiChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedSections.submission && (
                  <CardContent className="pt-0 pb-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      <InfoRow icon={<FiFileText className="w-4 h-4" />} label="Reference ID" value={app.submission?.application_reference_id ?? ''} />
                      <InfoRow icon={<FiClock className="w-4 h-4" />} label="Submitted On" value={formatDate(app.submission?.submission_timestamp ?? '')} />
                      <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Approved Amount" value={formatINR(app.submission?.approved_loan_amount)} />
                      <InfoRow icon={<FiDollarSign className="w-4 h-4" />} label="Monthly EMI" value={formatINR(app.submission?.monthly_emi)} />
                      <InfoRow icon={<FiCalendar className="w-4 h-4" />} label="Tenure" value={`${app.submission?.tenure_months ?? 0} months`} />
                    </div>
                    {app.submission?.confirmation_message && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                        <p className="text-sm text-green-800">{app.submission.confirmation_message}</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          <div className="mt-6">
            <Button variant="outline" onClick={() => navigateTo('dashboard')} className="gap-2">
              <FiArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════
  // ══ RENDER ══
  // ══════════════════════════
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Sidebar */}
        <Sidebar currentScreen={currentScreen} onNavigate={(screen) => { navigateTo(screen) }} />

        {/* Main Content */}
        {currentScreen === 'dashboard' && <DashboardScreen />}
        {currentScreen === 'onboarding' && <OnboardingScreen />}
        {currentScreen === 'review' && <ReviewScreen />}
        {currentScreen === 'confirmation' && <ConfirmationScreen />}
        {currentScreen === 'detail' && <DetailScreen />}

        {/* Active Agent Indicator */}
        {activeAgentId && (
          <div className="fixed bottom-6 left-72 bg-card border border-border/50 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 z-50">
            <FiLoader className="w-4 h-4 animate-spin text-accent" />
            <span className="text-xs text-muted-foreground">
              {activeAgentId === LOAN_CALC_AGENT_ID ? 'Calculating loan offer...' : 'Submitting application...'}
            </span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
