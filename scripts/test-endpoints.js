#!/usr/bin/env node

/**
 * REGRET Airdrop - Endpoint Testing Script
 * 
 * This script tests:
 * - Database connectivity
 * - All API endpoints
 * - Full workflow (register, spin, referral)
 * - Transaction integrity
 * 
 * Usage: node scripts/test-endpoints.js [--url http://localhost:3000]
 */

import fetch from 'node-fetch';

// Configuration
const API_BASE_URL = process.argv[2]?.includes('--url') 
    ? process.argv[3] || 'http://localhost:3000'
    : 'http://localhost:3000';

const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{44}$/;

// Test state
let testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

let testWallets = {
    referrer: generateSolanaAddress(),
    referred: generateSolanaAddress(),
    random: generateSolanaAddress()
};

let testData = {
    referralCode: null,
    referrerTokens: null
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateSolanaAddress() {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function log(level, message, data = '') {
    const timestamp = new Date().toISOString();
    const levels = {
        '✅': '\x1b[32m',  // Green
        '❌': '\x1b[31m',  // Red
        '🔵': '\x1b[34m',  // Blue
        '⚠️ ': '\x1b[33m'   // Yellow
    };
    const reset = '\x1b[0m';
    
    console.log(`${levels[level] || ''}[${timestamp}] ${level} ${message}${reset}`, data);
}

async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        
        const data = await response.json();
        
        return {
            status: response.status,
            ok: response.ok,
            data
        };
    } catch (error) {
        throw new Error(`Network error: ${error.message}`);
    }
}

function assert(condition, testName, message = '') {
    if (condition) {
        testResults.passed++;
        log('✅', `PASS: ${testName}`, message);
        return true;
    } else {
        testResults.failed++;
        const errorMsg = `FAIL: ${testName}${message ? ' - ' + message : ''}`;
        testResults.errors.push(errorMsg);
        log('❌', errorMsg);
        return false;
    }
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testHealth() {
    log('🔵', 'Testing Health Endpoint...');
    
    try {
        const result = await apiCall('/api/health');
        assert(result.ok, 'Health endpoint accessible', `Status: ${result.status}`);
        assert(result.data.database?.status === 'healthy', 'Database is healthy', result.data.database?.status);
        assert(result.data.version, 'API version present');
        
        return true;
    } catch (error) {
        assert(false, 'Health endpoint', error.message);
        return false;
    }
}

async function testRegister() {
    log('🔵', 'Testing Register Endpoint...');
    
    try {
        const result = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                wallet: testWallets.referrer,
                walletType: 'phantom',
                sessionId: 'test-session-' + Date.now(),
                userAgent: 'Test Script'
            })
        });
        
        assert(result.ok, 'Register endpoint returns 200', `Status: ${result.status}`);
        assert(result.data.success, 'Register response success flag');
        assert(result.data.data?.referralCode, 'Referral code generated');
        assert(result.data.data?.tokens === 1000, 'Correct initial tokens (1000)');
        
        if (result.data.data?.referralCode) {
            testData.referralCode = result.data.data.referralCode;
        }
        
        return result.ok;
    } catch (error) {
        assert(false, 'Register endpoint', error.message);
        return false;
    }
}

async function testRegisterDuplicate() {
    log('🔵', 'Testing Duplicate Register (should handle gracefully)...');
    
    try {
        const result = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                wallet: testWallets.referrer,
                walletType: 'phantom'
            })
        });
        
        // Should return 200 with "alreadyRegistered" flag or appropriate error
        assert(result.status === 200 || result.status === 409, 
            'Duplicate register handled', 
            `Status: ${result.status}`);
        assert(result.data.data?.alreadyRegistered || result.data.error, 
            'Response indicates duplicate registration');
        
        return true;
    } catch (error) {
        assert(false, 'Duplicate register handling', error.message);
        return false;
    }
}

async function testRegisterReferred() {
    log('🔵', 'Testing Register for Referred Wallet...');
    
    try {
        const result = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                wallet: testWallets.referred,
                walletType: 'solflare'
            })
        });
        
        assert(result.ok, 'Register referred wallet returns 200');
        assert(result.data.success, 'Referred wallet registered successfully');
        
        return result.ok;
    } catch (error) {
        assert(false, 'Register referred wallet', error.message);
        return false;
    }
}

async function testStats() {
    log('🔵', 'Testing Stats Endpoint...');
    
    try {
        const result = await apiCall('/api/stats');
        
        assert(result.ok, 'Stats endpoint returns 200');
        assert(result.data.data?.totalParticipants > 0, 'Total participants present');
        assert(result.data.data?.tokensReserved > 0, 'Tokens reserved present');
        assert(result.data.data?.daysToLaunch >= 0, 'Days to launch present');
        
        return true;
    } catch (error) {
        assert(false, 'Stats endpoint', error.message);
        return false;
    }
}

async function testSpin() {
    log('🔵', 'Testing Spin Endpoint...');
    
    try {
        const result = await apiCall('/api/spin', {
            method: 'POST',
            body: JSON.stringify({
                wallet: testWallets.referrer
            })
        });
        
        assert(result.ok, 'Spin endpoint returns 200', `Status: ${result.status}`);
        assert(result.data.success, 'Spin successful flag');
        assert(result.data.data?.prize > 0, 'Prize amount returned', `Prize: ${result.data.data?.prize}`);
        assert(result.data.data?.newBalance > 1000, 'Token balance updated');
        
        testData.referrerTokens = result.data.data?.newBalance;
        
        return result.ok;
    } catch (error) {
        // Expected to fail on second call (already spun today)
        if (error.message.includes('Already spun')) {
            assert(true, 'Spin prevents duplicate spins', 'Expected behavior');
            return true;
        }
        assert(false, 'Spin endpoint', error.message);
        return false;
    }
}

async function testSpinDuplicate() {
    log('🔵', 'Testing Duplicate Spin (should fail - daily limit)...');
    
    try {
        const result = await apiCall('/api/spin', {
            method: 'POST',
            body: JSON.stringify({
                wallet: testWallets.referrer
            })
        });
        
        assert(result.status === 429, 'Duplicate spin rejected with 429', `Status: ${result.status}`);
        assert(result.data.code === 'ALREADY_SPUN_TODAY', 'Correct error code for duplicate spin');
        
        return true;
    } catch (error) {
        assert(false, 'Duplicate spin prevention', error.message);
        return false;
    }
}

async function testAddReferral() {
    log('🔵', 'Testing Add Referral Endpoint...');
    
    if (!testData.referralCode) {
        assert(false, 'Add referral', 'No referral code from registration test');
        return false;
    }
    
    try {
        const result = await apiCall('/api/referrals/add', {
            method: 'POST',
            body: JSON.stringify({
                referrerWallet: testWallets.referrer,
                referredWallet: testWallets.referred,
                referralCode: testData.referralCode
            })
        });
        
        assert(result.ok, 'Add referral returns 200', `Status: ${result.status}`);
        assert(result.data.success, 'Referral added successfully');
        assert(result.data.data?.awardedTokens === 500, 'Correct reward tokens (500)');
        
        return result.ok;
    } catch (error) {
        assert(false, 'Add referral endpoint', error.message);
        return false;
    }
}

async function testInvalidInputs() {
    log('🔵', 'Testing Invalid Input Handling...');
    
    // Invalid wallet address
    try {
        const result = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                wallet: 'invalid_address',
                walletType: 'phantom'
            })
        });
        
        assert(result.status === 400, 'Invalid wallet rejected', `Status: ${result.status}`);
    } catch (error) {
        assert(false, 'Invalid wallet handling', error.message);
    }
    
    // Missing required fields
    try {
        const result = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                wallet: testWallets.random
            })
        });
        
        assert(result.status === 400, 'Missing fields rejected', `Status: ${result.status}`);
    } catch (error) {
        assert(false, 'Missing fields handling', error.message);
    }
}

async function testCORSHeaders() {
    log('🔵', 'Testing CORS Headers...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const corsHeader = response.headers.get('Access-Control-Allow-Origin');
        
        assert(corsHeader !== null, 'CORS header present', `Value: ${corsHeader}`);
        assert(corsHeader !== '*', 'CORS not open to all origins', `Value: ${corsHeader}`);
    } catch (error) {
        assert(false, 'CORS headers', error.message);
    }
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('REGRET Airdrop - API Testing Suite');
    console.log('='.repeat(70) + '\n');
    
    log('🔵', `Testing API: ${API_BASE_URL}\n`);
    
    // Test health first
    const healthOk = await testHealth();
    if (!healthOk) {
        log('❌', 'Cannot continue: Database or API not accessible');
        process.exit(1);
    }
    
    console.log('');
    
    // Run tests in order
    await testRegister();
    await testRegisterDuplicate();
    await testRegisterReferred();
    await testStats();
    await testSpin();
    await testSpinDuplicate();
    await testAddReferral();
    await testInvalidInputs();
    await testCORSHeaders();
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    log('✅', `Passed: ${testResults.passed}`);
    log('❌', `Failed: ${testResults.failed}`);
    
    if (testResults.errors.length > 0) {
        console.log('\nErrors:');
        testResults.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    console.log('='.repeat(70) + '\n');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    log('❌', 'Test suite error', error.message);
    process.exit(1);
});
