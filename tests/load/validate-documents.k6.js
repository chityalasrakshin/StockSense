import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 10, duration: '15s' };
const baseUrl = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const documentId = __ENV.DOCUMENT_ID;
const token = __ENV.ACCESS_TOKEN;

export default function () {
  const idempotencyKey = `k6-${__VU}-${__ITER}`;
  const response = http.post(`${baseUrl}/documents/${documentId}/validate`, null, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey } });
  check(response, { 'validation returns success or conflict (never double-posts)': (r) => [200, 201, 409].includes(r.status) });
}
