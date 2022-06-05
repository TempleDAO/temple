const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

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

  async getEnv(team, project, env) {
    const list = await this.get(
      `/v9/projects/${project}/env?teamId=${team}&decrypt=true`
    );

    return list.envs
      .filter((entry) => entry.target.includes(env))
      .sort(function (a, b) {
        if (a.key < b.key) {
          return -1;
        }
        if (a.key > b.key) {
          return 1;
        }
        return 0;
      });
  }

  async deleteEnvs(env, team, project) {
    const list = await this.getEnv(team, project, env);
    for await (const e of list) {
      let r = await this.delete(
        `/v9/projects/${project}/env/${e.id}?teamId=${team}`
      );
    }
  }

  async setEnv(data, team, project) {
    return this.post(`/v9/projects/${project}/env?teamId=${team}`, data);
  }

  async post(path, body) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: this.headers,
    });
    return response.json();
  }

  async delete(path) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers,
    });
    return response.json();
  }
}

module.exports = Vercel;
