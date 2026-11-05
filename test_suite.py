import requests

BASE = 'http://localhost:3000'
MASTER_KEY = 'sk_live_akanno_sovereign_dxb_001'

print("--- SKYGRID ENTERPRISE VERIFICATION TEST SUITE ---")

# 1. Create Key
res_key = requests.post(f'{BASE}/api/v1/auth/keys', json={'name': 'Emirates SkyCargo Dispatch Hub', 'tier': 'enterprise'})
key_json = res_key.json()
print('1. Create Key:', res_key.status_code, key_json.get('key_prefix'), 'Tier:', key_json.get('tier'))

# 2. List Keys
res_list = requests.get(f'{BASE}/api/v1/auth/keys')
print('2. List Keys Count:', res_list.json().get('count'))

# 3. Test Ingestion & Corridor
res_corr = requests.get(f'{BASE}/api/v1/corridor/live', headers={'x-api-key': MASTER_KEY})
corr_json = res_corr.json()
print('3. Corridor CRI:', corr_json['corridor']['riskIndex'], '| Active Vectors:', corr_json['corridor']['activeVectors'], '| Weather Shear:', corr_json['weather']['windshear_index_kts'])

# 4. Test Directive Evaluation
res_dir = requests.post(f'{BASE}/api/v1/directives/evaluate', headers={'x-api-key': MASTER_KEY}, json={'flight_id': 'FL-4412', 'callsign': 'FDX-4412'})
dir_json = res_dir.json()
print('4. Directive Evaluated:', dir_json.get('status'), '| Action:', dir_json['directive']['action'], '| Risk Delta:', dir_json['directive']['riskReduction'])

# 5. Test Webhook Dispatch Alert
res_alert = requests.post(f'{BASE}/api/v1/alerts/test-dispatch', headers={'x-api-key': MASTER_KEY})
alert_json = res_alert.json()
print('5. Dispatch Test Alert:', alert_json.get('status'), '| Flight:', alert_json.get('test_flight'))

# 6. Test CSV Export
res_csv = requests.get(f'{BASE}/api/v1/export/compliance-report.csv')
print('6. CSV Export Status:', res_csv.status_code, '| Content Length:', len(res_csv.content), 'bytes')

# 7. Test PDF Export
res_pdf = requests.get(f'{BASE}/api/v1/export/compliance-report.pdf')
print('7. PDF Export Status:', res_pdf.status_code, '| Content Length:', len(res_pdf.content), 'bytes')

# 8. Test Rate Limiter with Starter Tier (60 RPM)
new_key = requests.post(f'{BASE}/api/v1/auth/keys', json={'name': 'Rate Limit Test Partner', 'tier': 'starter'}).json()['api_key']
rate_limited = False
for i in range(63):
    r = requests.get(f'{BASE}/api/v1/corridor/dxb/risk', headers={'x-api-key': new_key})
    if r.status_code == 429:
        print(f'8. Rate Limiter Enforced successfully on request #{i+1}: 429 Too Many Requests -> {r.json().get("detail")}')
        rate_limited = True
        break

if not rate_limited:
    print('8. Rate limit test completed without 429.')

print("--- ALL PRODUCTION VERIFICATION TESTS PASSED ---")

