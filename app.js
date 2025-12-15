const API_BASE_URL = 'https://travel-planner-ms-izocsrgyaq-uc.a.run.app'
const ITINERARIES_API = 'https://itineraries-ms-izocsrgyaq-uc.a.run.app'

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab

        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'))
        button.classList.add('active')

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'))
        document.getElementById(`${tabName}-tab`).classList.add('active')

        if (tabName === 'destinations') {
            loadDestinations()
        } else if (tabName === 'itineraries') {
            loadItineraries()
        }
    })
})

loadDestinations()

async function loadDestinations() {
    const container = document.getElementById('destinations-list')
    container.innerHTML = '<div class="loading">Loading destinations...</div>'

    try {
        const token = window.auth?.getJWTToken()
        const headers = {
            'Content-Type': 'application/json'
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${API_BASE_URL}/composite/destinations`, {
            headers
        })
        
        if (response.status === 401) {
            // Unauthorized - redirect to login
            window.auth?.logout()
            container.innerHTML = '<div class="error-message">Please log in to view destinations.</div>'
            return
        }
        
        if (!response.ok) throw new Error('Failed to fetch destinations')

        const destinations = await response.json()

        if (destinations.length === 0) {
            container.innerHTML = '<p>No destinations available.</p>'
            return
        }

        container.innerHTML = '<div class="destinations-grid"></div>'
        const grid = container.querySelector('.destinations-grid')

        destinations.forEach(dest => {
            const card = document.createElement('div')
            card.className = 'destination-card'

            const seasonsHTML = dest.seasons.map(season => {
                const seasonClass = season.season_name.toLowerCase()
                return `<span class="season-tag ${seasonClass}">${season.season_name} (${season.start_month}-${season.end_month})</span>`
            }).join('')

            card.innerHTML = `
                <h3>${dest.name}</h3>
                <div class="country">Country: ${dest.country_code} | Currency: ${dest.currency}</div>
                <div class="seasons">
                    <strong>Seasons:</strong><br>
                    ${seasonsHTML || '<em>No seasonal data</em>'}
                </div>
            `

            grid.appendChild(card)
        })
    } catch (error) {
        console.error('Error loading destinations:', error)
        container.innerHTML = `<div class="error-message">Failed to load destinations: ${error.message}</div>`
    }
}

async function loadItineraries() {
    const container = document.getElementById('itineraries-list')
    container.innerHTML = '<div class="loading">Loading itineraries...</div>'

    try {
        const token = window.auth?.getJWTToken()
        const headers = {
            'Content-Type': 'application/json'
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${ITINERARIES_API}/itineraries`, {
            headers
        })
        
        if (response.status === 401) {
            window.auth?.logout()
            container.innerHTML = '<div class="error-message">Please log in to view itineraries.</div>'
            return
        }
        
        if (!response.ok) throw new Error('Failed to fetch itineraries')

        const itineraries = await response.json()

        if (itineraries.length === 0) {
            container.innerHTML = '<p>No itineraries found. Create one to get started!</p>'
            return
        }

        container.innerHTML = ''

        for (const itinerary of itineraries) {
            const card = document.createElement('div')
            card.className = 'itinerary-card'

            const startDate = itinerary.start_date ? new Date(itinerary.start_date).toLocaleDateString() : 'Not set'
            const endDate = itinerary.end_date ? new Date(itinerary.end_date).toLocaleDateString() : 'Not set'

            let segmentsInfo = 'Loading segments...'
            try {
                const segmentsResponse = await fetch(`${ITINERARIES_API}/itineraries/${itinerary.id}/segments`)
                if (segmentsResponse.ok) {
                    const segments = await segmentsResponse.json()
                    segmentsInfo = `${segments.length} segment(s)`
                }
            } catch (e) {
                segmentsInfo = 'Unable to load segments'
            }

            card.innerHTML = `
                <h3>${itinerary.name}</h3>
                <div class="itinerary-meta">
                    <span><strong>Owner:</strong> ${itinerary.owner_user_id}</span>
                    <span><strong>Status:</strong> <span class="status-badge ${itinerary.status.toLowerCase()}">${itinerary.status}</span></span>
                </div>
                ${itinerary.description ? `<p>${itinerary.description}</p>` : ''}
                <div class="itinerary-meta">
                    <span><strong>Start:</strong> ${startDate}</span>
                    <span><strong>End:</strong> ${endDate}</span>
                    <span><strong>Segments:</strong> ${segmentsInfo}</span>
                </div>
                <div style="margin-top: 10px; font-size: 0.85rem; color: #666;">
                    ID: ${itinerary.id}
                </div>
            `

            container.appendChild(card)
        }
    } catch (error) {
        console.error('Error loading itineraries:', error)
        container.innerHTML = `<div class="error-message">Failed to load itineraries: ${error.message}</div>`
    }
}

document.getElementById('create-itinerary-form').addEventListener('submit', async (e) => {
    e.preventDefault()

    const resultDiv = document.getElementById('create-result')
    resultDiv.innerHTML = '<div class="loading">Creating itinerary...</div>'

    const formData = {
        name: document.getElementById('itinerary-name').value,
        owner_user_id: document.getElementById('owner-id').value,
        description: document.getElementById('description').value || null,
        start_date: document.getElementById('start-date').value || null,
        end_date: document.getElementById('end-date').value || null,
        status: 'DRAFT'
    }

    try {
        const response = await fetch(`${ITINERARIES_API}/itineraries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to create itinerary')
        }

        const result = await response.json()

        resultDiv.innerHTML = `
            <div class="success-message">
                <strong>Success!</strong> Itinerary created successfully.<br>
                <strong>ID:</strong> ${result.id}<br>
                <strong>Name:</strong> ${result.name}<br>
                <a href="#" onclick="switchToItinerariesTab(); return false;">View all itineraries</a>
            </div>
        `

        document.getElementById('create-itinerary-form').reset()
    } catch (error) {
        console.error('Error creating itinerary:', error)
        resultDiv.innerHTML = `<div class="error-message">Failed to create itinerary: ${error.message}</div>`
    }
})

function switchToItinerariesTab() {
    document.querySelector('[data-tab="itineraries"]').click()
}