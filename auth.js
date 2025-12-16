const TRAVEL_PLANNER_API = 'https://travel-planner-ms-izocsrgyaq-uc.a.run.app'
const GOOGLE_CLIENT_ID = '641211583543-p7s4smapf77ublrhb2mp0ssjqpcmmc4e.apps.googleusercontent.com'

let currentUser = null
let jwtToken = null

function initializeGoogleSignIn() {
  if (typeof google === 'undefined' || !google.accounts) {
    console.error('Google Identity Services library not loaded')
    return
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  })

  google.accounts.id.renderButton(
    document.getElementById('google-signin-button'),
    {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      width: 250
    }
  )

  google.accounts.id.prompt()
}

async function handleCredentialResponse(response) {
  try {
    const loginResponse = await fetch(`${TRAVEL_PLANNER_API}/auth/google-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        credential: response.credential
      })
    })

    if (!loginResponse.ok) {
      throw new Error('Failed to login')
    }

    const data = await loginResponse.json()
    jwtToken = data.token
    currentUser = data.user

    localStorage.setItem('jwt_token', jwtToken)
    localStorage.setItem('user_info', JSON.stringify(currentUser))

    updateAuthUI()

    if (typeof loadDestinations === 'function') {
      loadDestinations()
    }
  } catch (error) {
    console.error('Login error:', error)
    alert('Failed to login. Please try again.')
  }
}

function logout() {
  jwtToken = null
  currentUser = null
  localStorage.removeItem('jwt_token')
  localStorage.removeItem('user_info')

  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect()
  }

  updateAuthUI()
}

function updateAuthUI() {
  const authSection = document.getElementById('auth-section')
  const userInfo = document.getElementById('user-info')
  const loginButton = document.getElementById('google-signin-button')
  const logoutButton = document.getElementById('logout-button')

  if (currentUser) {
    if (userInfo) {
      userInfo.innerHTML = `
        <div class="user-display">
          <img src="${currentUser.picture || ''}" alt="User" class="user-avatar" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;">
          <span>${currentUser.name || currentUser.email}</span>
        </div>
      `
      userInfo.style.display = 'block'
    }
    if (logoutButton) {
      logoutButton.style.display = 'block'
    }
    if (loginButton) {
      loginButton.style.display = 'none'
    }
  } else {
    if (userInfo) {
      userInfo.style.display = 'none'
    }
    if (logoutButton) {
      logoutButton.style.display = 'none'
    }
    if (loginButton) {
      loginButton.style.display = 'block'
    }
  }
}

function getJWTToken() {
  if (!jwtToken) {
    jwtToken = localStorage.getItem('jwt_token')
  }
  return jwtToken
}

function isAuthenticated() {
  return !!getJWTToken()
}

document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    const storedToken = localStorage.getItem('jwt_token')
    const storedUser = localStorage.getItem('user_info')

    if (storedToken && storedUser) {
      jwtToken = storedToken
      currentUser = JSON.parse(storedUser)
      updateAuthUI()
    } else {
      initializeGoogleSignIn()
    }
  }
  document.head.appendChild(script)
})

window.auth = {
  getJWTToken,
  isAuthenticated,
  logout,
  currentUser: () => currentUser
}
