import axios from 'axios'

const BASE_URL = 'http://localhost:4000/api'
const TEST_EMAIL_CANDIDATE = 'finoananorohanta@gmail.com'
const TEST_EMAIL_RECRUITER = 'finoananorohanta+recruiter@gmail.com'
const PASSWORD = 'TestPassword123!'

interface TestResult {
  endpoint: string
  method: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  statusCode?: number
  error?: string
  notes?: string
}

const results: TestResult[] = []

const api = axios.create({ baseURL: BASE_URL })

// Variables pour stocker les IDs nécessaires
let candidateToken: string
let recruiterToken: string
let opportunityId: string
let providerId: string
let recommendationId: string

// =======================
// HELPER FUNCTIONS
// =======================

async function registerUser(email: string, role: 'candidate' | 'recruiter') {
  try {
    // Step 1: Send verification code
    const sendRes = await api.post('/verification/send-code', { email })
    console.log(`✓ Verification code sent to ${email}`)

    // Step 2: Verify code (mock)
    const verifyRes = await api.post('/verification/verify-code', {
      email,
      code: '1234', // Mock code - adjust if needed
    })
    const token = verifyRes.data.verificationToken

    // Step 3: Register
    const registerRes = await api.post('/auth/register', {
      email,
      password: PASSWORD,
      role,
      verificationToken: token,
      candidateProfile: role === 'candidate' ? {
        fullName: 'Test Candidate',
        phone: '+261 32 00 000 00',
        province: 'Antananarivo',
        city: 'Antananarivo',
        gender: 'homme',
        educationLevel: 'licence',
        skills: ['JavaScript', 'React'],
        experienceLevel: 'junior',
        desiredOpportunityTypes: ['emploi'],
        availability: 'immediate',
      } : undefined,
      recruiterProfile: role === 'recruiter' ? {
        companyName: 'Test Company',
        phone: '+261 32 11 111 11',
        province: 'Antananarivo',
        city: 'Antananarivo',
        sector: 'digital',
      } : undefined,
    })

    return registerRes.data.user.id
  } catch (err: any) {
    throw new Error(`Registration failed: ${err.response?.data?.error || err.message}`)
  }
}

async function loginUser(email: string): Promise<string> {
  try {
    const res = await api.post('/auth/login', {
      email,
      password: PASSWORD,
    })
    return res.data.token
  } catch (err: any) {
    throw new Error(`Login failed: ${err.response?.data?.error || err.message}`)
  }
}

async function testEndpoint(
  endpoint: string,
  method: string,
  token?: string,
  data?: any,
): Promise<TestResult> {
  try {
    const config: any = {}
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` }
    }

    let response: any
    switch (method.toUpperCase()) {
      case 'GET':
        response = await api.get(endpoint, config)
        break
      case 'POST':
        response = await api.post(endpoint, data, config)
        break
      case 'PUT':
        response = await api.put(endpoint, data, config)
        break
      case 'PATCH':
        response = await api.patch(endpoint, data, config)
        break
      case 'DELETE':
        response = await api.delete(endpoint, config)
        break
      default:
        throw new Error(`Unknown method: ${method}`)
    }

    return {
      endpoint,
      method: method.toUpperCase(),
      status: 'PASS',
      statusCode: response.status,
      notes: `${response.status} OK`,
    }
  } catch (err: any) {
    const statusCode = err.response?.status
    const error = err.response?.data?.error || err.message

    // Some endpoints return 401/403 without auth, that's normal
    if ((statusCode === 401 || statusCode === 403) && !token) {
      return {
        endpoint,
        method: method.toUpperCase(),
        status: 'SKIP',
        statusCode,
        notes: 'Requires authentication (expected)',
      }
    }

    return {
      endpoint,
      method: method.toUpperCase(),
      status: 'FAIL',
      statusCode,
      error,
    }
  }
}

// =======================
// MAIN TEST SUITE
// =======================

async function runTests() {
  console.log('🧪 Starting API Test Suite...\n')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Testing at: ${new Date().toISOString()}\n`)

  try {
    // ===== AUTH TESTS =====
    console.log('📝 Testing Authentication Endpoints...')

    // Register candidate
    console.log('  Registering candidate...')
    await registerUser(TEST_EMAIL_CANDIDATE, 'candidate')
    candidateToken = await loginUser(TEST_EMAIL_CANDIDATE)
    results.push({
      endpoint: '/auth/register + /auth/login',
      method: 'POST',
      status: 'PASS',
      notes: 'Candidate registration and login successful',
    })

    // Register recruiter
    console.log('  Registering recruiter...')
    await registerUser(TEST_EMAIL_RECRUITER, 'recruiter')
    recruiterToken = await loginUser(TEST_EMAIL_RECRUITER)
    results.push({
      endpoint: '/auth/register + /auth/login',
      method: 'POST',
      status: 'PASS',
      notes: 'Recruiter registration and login successful',
    })

    // Get me
    results.push(
      await testEndpoint('/auth/me', 'GET', candidateToken),
    )

    // ===== OPPORTUNITIES TESTS =====
    console.log('📋 Testing Opportunities Endpoints...')

    // Get all opportunities
    results.push(
      await testEndpoint('/opportunities', 'GET', candidateToken),
    )

    // Get my opportunities (recruiter)
    results.push(
      await testEndpoint('/opportunities/mine', 'GET', recruiterToken),
    )

    // Create opportunity
    const createOppRes = await testEndpoint('/opportunities', 'POST', recruiterToken, {
      title: 'Test Developer',
      category: 'IT / Digital',
      description: 'Test opportunity',
      province: 'Antananarivo',
      city: 'Antananarivo',
      opportunityType: 'emploi',
      requiredSkills: ['JavaScript'],
      level: 'junior',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    results.push(createOppRes)
    if (createOppRes.status === 'PASS') {
      const oppRes = await api.post('/opportunities', {
        title: 'Test Developer',
        category: 'IT / Digital',
        description: 'Test opportunity',
        province: 'Antananarivo',
        city: 'Antananarivo',
        opportunityType: 'emploi',
        requiredSkills: ['JavaScript'],
        level: 'junior',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { headers: { Authorization: `Bearer ${recruiterToken}` } })
      opportunityId = oppRes.data.opportunity.id
    }

    // Get opportunity by ID
    if (opportunityId) {
      results.push(
        await testEndpoint(`/opportunities/${opportunityId}`, 'GET', candidateToken),
      )
    }

    // ===== APPLICATIONS TESTS =====
    console.log('📧 Testing Applications Endpoints...')

    results.push(
      await testEndpoint('/applications/mine', 'GET', candidateToken),
    )

    results.push(
      await testEndpoint('/applications/received', 'GET', recruiterToken),
    )

    // ===== NOTIFICATIONS TESTS =====
    console.log('🔔 Testing Notifications Endpoints...')

    results.push(
      await testEndpoint('/notifications/mine', 'GET', candidateToken),
    )

    // ===== DIRECTORY TESTS =====
    console.log('📚 Testing Directory Endpoints...')

    results.push(
      await testEndpoint('/directory/providers', 'GET'),
    )

    results.push(
      await testEndpoint('/directory/raw', 'GET'),
    )

    // ===== MATCH SUGGESTIONS TESTS =====
    console.log('🎯 Testing Match Suggestions Endpoints...')

    results.push(
      await testEndpoint('/match-suggestions/mine', 'GET', candidateToken),
    )

    results.push(
      await testEndpoint('/match-suggestions/received', 'GET', recruiterToken),
    )

    // ===== BILLING TESTS =====
    console.log('💳 Testing Billing Endpoints...')

    results.push(
      await testEndpoint('/billing/plans', 'GET'),
    )

    results.push(
      await testEndpoint('/billing/subscription', 'GET', recruiterToken),
    )

    // ===== VERIFICATION TESTS =====
    console.log('✅ Testing Verification Endpoints...')

    results.push(
      await testEndpoint('/verification/status?email=' + TEST_EMAIL_CANDIDATE, 'GET'),
    )

    // ===== PUBLIC TESTS =====
    console.log('🌍 Testing Public Endpoints...')

    results.push(
      await testEndpoint('/talent-leads', 'POST', undefined, {
        fullName: 'Test User',
        phone: '+261 32 00 000 00',
        trade: 'Developer',
        experience: 'Test',
      }),
    )

    console.log('\n✅ All tests completed!')

  } catch (error: any) {
    console.error('❌ Test suite failed:', error.message)
  }

  // Print Results
  console.log('\n' + '='.repeat(80))
  console.log('📊 TEST RESULTS')
  console.log('='.repeat(80) + '\n')

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length

  console.log(`✅ PASSED: ${passed}`)
  console.log(`❌ FAILED: ${failed}`)
  console.log(`⏭️  SKIPPED: ${skipped}`)
  console.log(`📊 TOTAL: ${results.length}\n`)

  // Print failures
  if (failed > 0) {
    console.log('❌ FAILED ENDPOINTS:')
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  ${r.method} ${r.endpoint}`)
        console.log(`    Status: ${r.statusCode}`)
        console.log(`    Error: ${r.error}\n`)
      })
  }

  // Print all results in table format
  console.log('\n📋 DETAILED RESULTS:\n')
  console.table(results)
}

runTests().catch(console.error)
