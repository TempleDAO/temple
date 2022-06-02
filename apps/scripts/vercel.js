const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class Vercel {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://api.vercel.com';
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  async get(path) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }
}

module.exports = Vercel;
