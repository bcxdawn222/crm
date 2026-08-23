import http from 'http'

const options = {
  hostname: 'localhost',
  port: 3008,
  path: '/api/customers?page=1&pageSize=10',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
}

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`)
  console.log(`Headers: ${JSON.stringify(res.headers)}`)
  
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    console.log('\nResponse Body:')
    try {
      const json = JSON.parse(data)
      console.log(JSON.stringify(json, null, 2))
    } catch (e) {
      console.log(data)
    }
  })
})

req.on('error', (error) => {
  console.error('Error:', error.message)
})

req.end()
