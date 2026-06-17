/**
 * GitHub OAuth Device Flow Helper
 * Manages GitHub authentication using the device flow
 */

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

class GitHubAuth {
  constructor() {
    this.token = this.loadToken();
    this.user = this.loadUser();
  }

  /**
   * Check if authenticated
   */
  get isAuthenticated() {
    return !!this.token;
  }

  /**
   * Get auth token
   */
  getToken() {
    return this.token;
  }

  /**
   * Get authenticated user
   */
  getUser() {
    return this.user;
  }

  /**
   * Start device flow authentication
   * Returns device code info for user to complete
   */
  async startAuth() {
    try {
      const response = await fetch(DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GITHUB_CLIENT_ID,
          scope: 'repo read:user',
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresIn: data.expires_in,
        interval: data.interval,
      };
    } catch (error) {
      console.error('GitHub auth start failed:', error);
      throw error;
    }
  }

  /**
   * Poll for access token
   */
  async pollForToken(deviceCode, interval = 5) {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        attempts++;

        if (attempts > maxAttempts) {
          reject(new Error('Authentication timed out. Please try again.'));
          return;
        }

        try {
          const response = await fetch(ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: GITHUB_CLIENT_ID,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
          });

          const data = await response.json();

          if (data.error) {
            if (data.error === 'authorization_pending') {
              setTimeout(poll, interval * 1000);
              return;
            }
            if (data.error === 'slow_down') {
              setTimeout(poll, (interval + 5) * 1000);
              return;
            }
            if (data.error === 'expired_token') {
              reject(new Error('The device code has expired. Please start again.'));
              return;
            }
            reject(new Error(data.error_description || data.error));
            return;
          }

          // Success!
          this.token = data.access_token;
          this.saveToken(data.access_token);

          // Fetch user info
          await this.fetchUser();

          resolve({
            token: data.access_token,
            scope: data.scope,
            user: this.user,
          });
        } catch (error) {
          reject(error);
        }
      };

      setTimeout(poll, interval * 1000);
    });
  }

  /**
   * Fetch authenticated user info
   */
  async fetchUser() {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const user = await response.json();
      this.user = {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatar: user.avatar_url,
        email: user.email,
      };
      this.saveUser(this.user);
      return this.user;
    } catch (error) {
      console.error('Failed to fetch GitHub user:', error);
      throw error;
    }
  }

  /**
   * Logout - clear token
   */
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
  }

  /**
   * Save token to localStorage
   */
  saveToken(token) {
    try {
      localStorage.setItem('github_token', token);
    } catch (e) {
      console.warn('Could not save token to localStorage');
    }
  }

  /**
   * Load token from localStorage
   */
  loadToken() {
    try {
      return localStorage.getItem('github_token');
    } catch (e) {
      return null;
    }
  }

  /**
   * Save user to localStorage
   */
  saveUser(user) {
    try {
      localStorage.setItem('github_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Could not save user to localStorage');
    }
  }

  /**
   * Load user from localStorage
   */
  loadUser() {
    try {
      const stored = localStorage.getItem('github_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get headers for authenticated requests
   */
  getAuthHeaders() {
    return this.token
      ? { Authorization: `token ${this.token}` }
      : {};
  }
}

export const githubAuth = new GitHubAuth();
