#!/usr/bin/env python3
"""
Backend API Testing for Finance Tracker
Tests all backend endpoints after Vercel deployment hardening
"""

import requests
import json
import io
import sys

# Base URL from environment
BASE_URL = "https://github-nextjs-setup.preview.emergentagent.com/api"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_root_endpoint():
    """Test GET /api/root - health check"""
    print_section("TEST 1: GET /api/root")
    
    try:
        url = f"{BASE_URL}/root"
        print(f"Testing: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        # Validate response structure
        if "message" not in data:
            print("✗ FAILED: Response missing 'message' field")
            return False
        
        if data["message"] != "Finance Tracker API":
            print(f"✗ FAILED: Expected message 'Finance Tracker API', got '{data['message']}'")
            return False
        
        print("✓ PASSED: GET /api/root working correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred - {str(e)}")
        return False

def test_import_csv():
    """Test POST /api/import with CSV file"""
    print_section("TEST 2: POST /api/import (CSV)")
    
    try:
        url = f"{BASE_URL}/import"
        print(f"Testing: POST {url}")
        
        # Sample CSV as specified in requirements
        csv_content = """Date,Description,Amount
2026-09-01,STARBUCKS COFFEE #4521,-6.85
2026-09-02,PAYROLL DEPOSIT ACME,2400.00
2026-09-03,SHELL GAS STATION,-42.10
2026-09-04,NETFLIX SUBSCRIPTION,-15.99"""
        
        print(f"CSV Content:\n{csv_content}\n")
        
        # Create file-like object
        files = {
            'file': ('transactions.csv', io.BytesIO(csv_content.encode('utf-8')), 'text/csv')
        }
        
        response = requests.post(url, files=files, timeout=30)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        # Validate response structure
        required_fields = ['count', 'transactions', 'preview']
        for field in required_fields:
            if field not in data:
                print(f"✗ FAILED: Response missing '{field}' field")
                return False
        
        # Validate count
        if not isinstance(data['count'], int):
            print(f"✗ FAILED: 'count' should be integer, got {type(data['count'])}")
            return False
        
        if data['count'] != 4:
            print(f"✗ FAILED: Expected count=4, got {data['count']}")
            return False
        
        print(f"✓ Count: {data['count']} transactions")
        
        # Validate transactions array
        if not isinstance(data['transactions'], list):
            print(f"✗ FAILED: 'transactions' should be array")
            return False
        
        if len(data['transactions']) != 4:
            print(f"✗ FAILED: Expected 4 transactions, got {len(data['transactions'])}")
            return False
        
        # Validate each transaction has required fields
        required_tx_fields = ['date', 'note', 'amount', 'type', 'category']
        for i, tx in enumerate(data['transactions']):
            for field in required_tx_fields:
                if field not in tx:
                    print(f"✗ FAILED: Transaction {i} missing '{field}' field")
                    return False
        
        print("✓ All transactions have required fields")
        
        # Validate specific categorizations
        payroll_found = False
        netflix_found = False
        
        for tx in data['transactions']:
            print(f"  - {tx['date']} | {tx['note']} | ${tx['amount']} | {tx['type']} | {tx['category']}")
            
            # Check PAYROLL is income with Salary category
            if 'PAYROLL' in tx['note'].upper() or 'ACME' in tx['note'].upper():
                payroll_found = True
                if tx['type'] != 'income':
                    print(f"✗ FAILED: PAYROLL should be type 'income', got '{tx['type']}'")
                    return False
                if tx['category'] != 'Salary':
                    print(f"✗ FAILED: PAYROLL should be category 'Salary', got '{tx['category']}'")
                    return False
                print(f"  ✓ PAYROLL correctly classified as income/Salary")
            
            # Check NETFLIX is Entertainment
            if 'NETFLIX' in tx['note'].upper():
                netflix_found = True
                if tx['category'] != 'Entertainment':
                    print(f"✗ FAILED: NETFLIX should be category 'Entertainment', got '{tx['category']}'")
                    return False
                print(f"  ✓ NETFLIX correctly classified as Entertainment")
            
            # Validate amount is positive number
            if not isinstance(tx['amount'], (int, float)) or tx['amount'] <= 0:
                print(f"✗ FAILED: Amount should be positive number, got {tx['amount']}")
                return False
        
        if not payroll_found:
            print("✗ FAILED: PAYROLL transaction not found in results")
            return False
        
        if not netflix_found:
            print("✗ FAILED: NETFLIX transaction not found in results")
            return False
        
        print("✓ PASSED: POST /api/import (CSV) working correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_insights():
    """Test POST /api/insights"""
    print_section("TEST 3: POST /api/insights")
    
    try:
        url = f"{BASE_URL}/insights"
        print(f"Testing: POST {url}")
        
        # Sample transactions as specified
        payload = {
            "transactions": [
                {"date": "2026-09-01", "type": "income", "category": "Salary", "amount": 3200, "note": "Payroll"},
                {"date": "2026-09-03", "type": "expense", "category": "Food & Dining", "amount": 128, "note": "Whole Foods"},
                {"date": "2026-09-04", "type": "expense", "category": "Coffee", "amount": 6.85, "note": "Starbucks"},
                {"date": "2026-08-01", "type": "income", "category": "Salary", "amount": 3200, "note": "Payroll"},
                {"date": "2026-08-04", "type": "expense", "category": "Food & Dining", "amount": 78, "note": "Trader Joes"}
            ]
        }
        
        print(f"Payload: {json.dumps(payload, indent=2)}\n")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        # Validate response has insights array
        if "insights" not in data:
            print("✗ FAILED: Response missing 'insights' field")
            return False
        
        if not isinstance(data['insights'], list):
            print("✗ FAILED: 'insights' should be array")
            return False
        
        if len(data['insights']) == 0:
            print("✗ FAILED: 'insights' array is empty")
            return False
        
        print(f"✓ Received {len(data['insights'])} insights")
        
        # Validate each insight has required fields
        required_fields = ['emoji', 'title', 'message', 'tone']
        valid_tones = ['positive', 'warning', 'info']
        
        for i, insight in enumerate(data['insights']):
            print(f"\nInsight {i+1}:")
            for field in required_fields:
                if field not in insight:
                    print(f"✗ FAILED: Insight {i} missing '{field}' field")
                    return False
            
            # Validate types
            if not isinstance(insight['emoji'], str):
                print(f"✗ FAILED: Insight {i} 'emoji' should be string")
                return False
            
            if not isinstance(insight['title'], str):
                print(f"✗ FAILED: Insight {i} 'title' should be string")
                return False
            
            if not isinstance(insight['message'], str):
                print(f"✗ FAILED: Insight {i} 'message' should be string")
                return False
            
            if insight['tone'] not in valid_tones:
                print(f"✗ FAILED: Insight {i} 'tone' should be one of {valid_tones}, got '{insight['tone']}'")
                return False
            
            print(f"  {insight['emoji']} {insight['title']}")
            print(f"  {insight['message']}")
            print(f"  Tone: {insight['tone']}")
        
        print("\n✓ PASSED: POST /api/insights working correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_coach_streaming():
    """Test POST /api/coach - streaming response"""
    print_section("TEST 4: POST /api/coach (Streaming)")
    
    try:
        url = f"{BASE_URL}/coach"
        print(f"Testing: POST {url}")
        
        # Sample payload as specified
        payload = {
            "message": "Why did my dining spending grow?",
            "history": [],
            "transactions": [
                {"date": "2026-09-03", "type": "expense", "category": "Food & Dining", "amount": 128, "note": "Whole Foods"},
                {"date": "2026-08-04", "type": "expense", "category": "Food & Dining", "amount": 78, "note": "Trader Joes"}
            ]
        }
        
        print(f"Payload: {json.dumps(payload, indent=2)}\n")
        
        response = requests.post(url, json=payload, stream=True, timeout=60)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Validate Content-Type
        content_type = response.headers.get('Content-Type', '')
        print(f"✓ Content-Type: {content_type}")
        
        if 'text/event-stream' not in content_type:
            print(f"✗ FAILED: Expected Content-Type 'text/event-stream', got '{content_type}'")
            return False
        
        print("✓ Streaming response detected")
        
        # Read stream chunks
        chunks = []
        token_chunks = 0
        done_chunk = None
        
        print("\nReading stream chunks...")
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data_str = line_str[6:]  # Remove 'data: ' prefix
                    try:
                        chunk_data = json.loads(data_str)
                        chunks.append(chunk_data)
                        
                        if 'token' in chunk_data:
                            token_chunks += 1
                            if token_chunks <= 3:  # Print first 3 tokens
                                print(f"  Token chunk {token_chunks}: {chunk_data['token'][:50]}...")
                        
                        if 'done' in chunk_data and chunk_data['done']:
                            done_chunk = chunk_data
                            print(f"  Done chunk received")
                            break
                            
                    except json.JSONDecodeError as e:
                        print(f"✗ FAILED: Could not parse chunk as JSON: {data_str}")
                        return False
        
        print(f"\n✓ Received {len(chunks)} total chunks")
        print(f"✓ Received {token_chunks} token chunks")
        
        # Validate we got at least 5 token chunks
        if token_chunks < 5:
            print(f"✗ FAILED: Expected at least 5 token chunks, got {token_chunks}")
            return False
        
        print(f"✓ Received sufficient token chunks ({token_chunks} >= 5)")
        
        # Validate we got a done chunk
        if not done_chunk:
            print("✗ FAILED: Did not receive final 'done' chunk")
            return False
        
        if 'full' not in done_chunk:
            print("✗ FAILED: Done chunk missing 'full' field")
            return False
        
        print(f"✓ Final response length: {len(done_chunk['full'])} characters")
        print(f"✓ Final response preview: {done_chunk['full'][:200]}...")
        
        print("\n✓ PASSED: POST /api/coach (Streaming) working correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*60)
    print("  FINANCE TRACKER BACKEND API TESTS")
    print("  Testing after Vercel deployment hardening")
    print("="*60)
    print(f"\nBase URL: {BASE_URL}\n")
    
    results = {}
    
    # Run tests in priority order
    results['GET /api/root'] = test_root_endpoint()
    results['POST /api/import (CSV)'] = test_import_csv()
    results['POST /api/insights'] = test_insights()
    results['POST /api/coach (Streaming)'] = test_coach_streaming()
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All backend tests PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
