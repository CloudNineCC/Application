const API_BASE_URL = 'https://travel-planner-ms-izocsrgyaq-uc.a.run.app'
const ITINERARIES_API = 'https://itineraries-ms-izocsrgyaq-uc.a.run.app'

let cityNamesById = null
let cityNamesByIdPromise = null

function cacheCityNames(destinations) {
    if (!Array.isArray(destinations)) return
    if (!cityNamesById) cityNamesById = {}
    destinations.forEach(dest => {
        if (dest && dest.id) {
            cityNamesById[dest.id] = dest.name || dest.id
        }
    })
}

async function ensureCityNames(headers) {
    if (cityNamesById) return cityNamesById
    if (cityNamesByIdPromise) return cityNamesByIdPromise

    cityNamesByIdPromise = (async () => {
        const response = await fetch(`${API_BASE_URL}/composite/destinations`, { headers })
        if (!response.ok) return {}
        const destinations = await response.json()
        cacheCityNames(destinations)
        return cityNamesById || {}
    })()

    try {
        cityNamesById = await cityNamesByIdPromise
    } catch (error) {
        console.warn('Failed to load city names:', error)
        cityNamesById = {}
    } finally {
        cityNamesByIdPromise = null
    }

    return cityNamesById
}

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
            window.auth?.logout()
            container.innerHTML = '<div class="error-message">Please log in to view destinations.</div>'
            return
        }
        
        if (!response.ok) throw new Error('Failed to fetch destinations')

        const destinations = await response.json()
        cacheCityNames(destinations)

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
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <h3 style="flex: 1;">${itinerary.name}</h3>
                    <button class="btn-delete" onclick="deleteItinerary('${itinerary.id}', event)" style="margin-left: 10px;">Delete</button>
                </div>
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

            card.style.cursor = 'pointer'
            card.addEventListener('click', () => showDetailView(itinerary.id))

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

let currentItineraryId = null
const PRICING_MS_URL = `${API_BASE_URL}/composite`

function showDetailView(itineraryId) {
    currentItineraryId = itineraryId

    document.querySelector('.tabs').style.display = 'none'
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none')
    document.getElementById('detail-view').style.display = 'block'

    loadItineraryDetails(itineraryId)
}

function hideDetailView() {
    currentItineraryId = null

    document.querySelector('.tabs').style.display = 'flex'
    document.getElementById('detail-view').style.display = 'none'

    const activeTab = document.querySelector('.tab-button.active')
    if (activeTab) {
        const tabName = activeTab.dataset.tab
        document.getElementById(`${tabName}-tab`).style.display = 'block'

        if (tabName === 'itineraries') {
            loadItineraries()
        }
    }
}

async function loadItineraryDetails(itineraryId) {
    try {
        const token = window.auth?.getJWTToken()
        const headers = {
            'Content-Type': 'application/json'
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${ITINERARIES_API}/itineraries/${itineraryId}`, { headers })
        if (!response.ok) throw new Error('Failed to load itinerary')

        const itinerary = await response.json()

        document.getElementById('detail-title').textContent = itinerary.name
        document.getElementById('detail-meta').innerHTML = `
            <span><strong>Owner:</strong> ${itinerary.owner_user_id}</span>
            <span><strong>Status:</strong> <span class="status-badge ${itinerary.status.toLowerCase()}">${itinerary.status}</span></span>
            <span><strong>Start:</strong> ${itinerary.start_date || 'Not set'}</span>
            <span><strong>End:</strong> ${itinerary.end_date || 'Not set'}</span>
        `

        document.getElementById('overview-content').innerHTML = `
            <p>${itinerary.description || 'No description provided.'}</p>
            <div style="margin-top: 20px;">
                <strong>Itinerary ID:</strong> ${itinerary.id}<br>
                <strong>Created:</strong> ${new Date(itinerary.created_at).toLocaleString()}
            </div>
        `

        loadSegments(itineraryId)
        loadComments(itineraryId)
        loadActivity(itineraryId)
        loadPricing(itineraryId)

    } catch (error) {
        console.error('Error loading itinerary details:', error)
        alert('Failed to load itinerary details')
    }
}

let destinationsCache = null

async function getCityName(cityId) {
    try {
        if (!destinationsCache) {
            const token = window.auth?.getJWTToken()
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`

            const response = await fetch(`${API_BASE_URL}/composite/destinations`, { headers })
            destinationsCache = await response.json()
        }

        const city = destinationsCache.find(d => d.id === cityId)
        return city ? city.name : null
    } catch (error) {
        console.error('Error fetching city name:', error)
        return null
    }
}

async function loadSegments(itineraryId) {
    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(`${ITINERARIES_API}/itineraries/${itineraryId}/segments`, { headers })
        const segments = await response.json()

        const container = document.getElementById('segments-list')

        if (segments.length === 0) {
            container.innerHTML = '<p>No segments yet. Add your first destination!</p>'
            return
        }

        const segmentsWithCities = await Promise.all(
            segments.map(async seg => ({
                ...seg,
                cityName: await getCityName(seg.city_id)
            }))
        )

        container.innerHTML = segmentsWithCities.map(seg => `
            <div class="segment-card">
                <div class="segment-header">
                    <h4>Segment ${seg.sequence_order + 1}</h4>
                    <button class="btn-delete" onclick="deleteSegment('${itineraryId}', '${seg.id}')">Delete</button>
                </div>
                <div class="segment-details">
                    <p><strong>City:</strong> ${seg.cityName || seg.city_id}</p>
                    <p class="city-id-small"><strong>ID:</strong> ${seg.city_id}</p>
                    <p><strong>Dates:</strong> ${seg.start_date} to ${seg.end_date}</p>
                    <p><strong>Lodging:</strong> ${seg.lodging_class}</p>
                    ${seg.notes ? `<p><strong>Notes:</strong> ${seg.notes}</p>` : ''}
                </div>
            </div>
        `).join('')

    } catch (error) {
        console.error('Error loading segments:', error)
        document.getElementById('segments-list').innerHTML = '<p class="error-message">Failed to load segments</p>'
    }
}

async function deleteSegment(itineraryId, segmentId) {
    if (!confirm('Delete this segment?')) return

    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(
            `${ITINERARIES_API}/itineraries/${itineraryId}/segments/${segmentId}`,
            { method: 'DELETE', headers }
        )

        if (!response.ok) throw new Error('Failed to delete segment')

        loadSegments(itineraryId)
        loadPricing(itineraryId)
    } catch (error) {
        console.error('Error deleting segment:', error)
        alert('Failed to delete segment')
    }
}

async function loadComments(itineraryId) {
    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(`${ITINERARIES_API}/itineraries/${itineraryId}/comments`, { headers })
        const comments = await response.json()

        const container = document.getElementById('comments-list')

        if (comments.length === 0) {
            container.innerHTML = '<p>No comments yet.</p>'
            return
        }

        container.innerHTML = comments.map(comment => `
            <div class="comment-card">
                <div class="comment-header">
                    <strong>${comment.user_id}</strong>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                    <button class="btn-delete-small" onclick="deleteComment('${itineraryId}', '${comment.id}')">×</button>
                </div>
                <p>${comment.text}</p>
            </div>
        `).join('')

    } catch (error) {
        console.error('Error loading comments:', error)
        document.getElementById('comments-list').innerHTML = '<p class="error-message">Failed to load comments</p>'
    }
}

async function deleteComment(itineraryId, commentId) {
    if (!confirm('Delete this comment?')) return

    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(
            `${ITINERARIES_API}/itineraries/${itineraryId}/comments/${commentId}`,
            { method: 'DELETE', headers }
        )

        if (!response.ok) throw new Error('Failed to delete comment')

        loadComments(itineraryId)
    } catch (error) {
        console.error('Error deleting comment:', error)
        alert('Failed to delete comment')
    }
}

async function loadActivity(itineraryId) {
    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(`${ITINERARIES_API}/itineraries/${itineraryId}/activity`, { headers })
        const activities = await response.json()

        const container = document.getElementById('activity-list')

        if (activities.length === 0) {
            container.innerHTML = '<p>No activity recorded.</p>'
            return
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${getActivityIcon(activity.action)}</div>
                <div class="activity-content">
                    <p><strong>${activity.user_id}</strong> ${activity.action}</p>
                    ${activity.details ? `<p class="activity-details">${activity.details}</p>` : ''}
                    <span class="activity-date">${new Date(activity.created_at).toLocaleString()}</span>
                </div>
            </div>
        `).join('')

    } catch (error) {
        console.error('Error loading activity:', error)
        document.getElementById('activity-list').innerHTML = '<p class="error-message">Failed to load activity</p>'
    }
}

function getActivityIcon(action) {
    const icons = {
        'created': '✨',
        'segment_added': '📍',
        'segment_deleted': '🗑️',
        'role_added': '👤',
        'comment_added': '💬',
        'status_changed': '🔄'
    }
    return icons[action] || '•'
}

async function loadPricing(itineraryId) {
    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const container = document.getElementById('pricing-content')
        container.innerHTML = '<div class="loading">Calculating pricing...</div>'

        // Fetch segments
        const segmentsResponse = await fetch(`${ITINERARIES_API}/itineraries/${itineraryId}/segments`, { headers })
        const segments = await segmentsResponse.json()

        if (segments.length === 0) {
            container.innerHTML = '<p>No pricing available. Add segments to get a quote.</p>'
            return
        }

        const quoteRequest = {
            segments: segments.map(seg => ({
                city_id: seg.city_id,
                start_date: seg.start_date,
                end_date: seg.end_date,
                lodging_class: seg.lodging_class ? seg.lodging_class.toUpperCase() : 'STANDARD'
            })),
            currency: 'USD'
        }

        const quoteResponse = await fetch(`${PRICING_MS_URL}/quotes`, {
            method: 'POST',
            headers,
            body: JSON.stringify(quoteRequest)
        })

        if (!quoteResponse.ok) throw new Error('Failed to calculate pricing')

        const pricing = await quoteResponse.json()
        const cityNames = await ensureCityNames(headers)

        let taxesFees = ''
        if (pricing.taxes_fees_applied && pricing.taxes_fees_applied.length > 0) {
            taxesFees = `
                <h4>Taxes & Fees Applied:</h4>
                <ul>
                    ${pricing.taxes_fees_applied.map(tf => `
                        <li>City: ${cityNames[tf.city_id] || tf.city_id} - ${tf.lodging_tax_pct}% + $${tf.fixed_fee_usd} fixed</li>
                    `).join('')}
                </ul>
            `
        }

        container.innerHTML = `
            <div class="pricing-summary">
                <h4>Total: $${pricing.total_usd.toFixed(2)} USD</h4>
                ${pricing.promo_code ? `<p>Promo code applied: ${pricing.promo_code}</p>` : ''}
            </div>

            <h4>Segment Breakdown:</h4>
            <table class="pricing-table">
                <thead>
                    <tr>
                        <th>City</th>
                        <th>Lodging</th>
                        <th>Nights</th>
                        <th>Rate/Night</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${pricing.per_segment.map(seg => `
                        <tr>
                            <td>${cityNames[seg.segment.city_id] || seg.segment.city_id}</td>
                            <td>${seg.segment.lodging_class}</td>
                            <td>${seg.nights}</td>
                            <td>$${seg.base_nightly_usd ? seg.base_nightly_usd.toFixed(2) : '0.00'}</td>
                            <td>$${seg.base_usd.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${taxesFees}
        `

    } catch (error) {
        console.error('Error loading pricing:', error)
        document.getElementById('pricing-content').innerHTML = '<p class="error-message">Failed to load pricing</p>'
    }
}

async function loadCitiesDropdown() {
    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(`${API_BASE_URL}/composite/destinations`, { headers })
        if (!response.ok) throw new Error('Failed to fetch destinations')

        const destinations = await response.json()
        cacheCityNames(destinations)

        const select = document.getElementById('new-segment-city')
        select.innerHTML = '<option value="">-- Select a city --</option>'

        destinations.forEach(dest => {
            const option = document.createElement('option')
            option.value = dest.id
            option.textContent = `${dest.name} (${dest.country_code})`
            select.appendChild(option)
        })
    } catch (error) {
        console.error('Error loading cities:', error)
    }
}

async function deleteItinerary(itineraryId, event) {
    event.stopPropagation()

    if (!confirm('Delete this itinerary? This action cannot be undone.')) return

    try {
        const token = window.auth?.getJWTToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const response = await fetch(
            `${ITINERARIES_API}/itineraries/${itineraryId}`,
            { method: 'DELETE', headers }
        )

        if (!response.ok) throw new Error('Failed to delete itinerary')

        loadItineraries()
    } catch (error) {
        console.error('Error deleting itinerary:', error)
        alert('Failed to delete itinerary')
    }
}

window.deleteItinerary = deleteItinerary

document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('back-to-list')
    if (backButton) {
        backButton.addEventListener('click', hideDetailView)
    }

    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.detailTab

            document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')

            document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'))
            const targetTab = document.getElementById(`${tabName}-detail-tab`)
            if (targetTab) {
                targetTab.classList.add('active')
            }
        })
    })

    const addSegmentBtn = document.getElementById('add-segment-btn')
    if (addSegmentBtn) {
        addSegmentBtn.addEventListener('click', () => {
            document.getElementById('add-segment-form').style.display = 'block'
            loadCitiesDropdown()
        })
    }

    const cancelSegmentBtn = document.getElementById('cancel-segment-btn')
    if (cancelSegmentBtn) {
        cancelSegmentBtn.addEventListener('click', () => {
            document.getElementById('add-segment-form').style.display = 'none'
        })
    }

    const saveSegmentBtn = document.getElementById('save-segment-btn')
    if (saveSegmentBtn) {
        saveSegmentBtn.addEventListener('click', async () => {
            const cityId = document.getElementById('new-segment-city').value
            const startDate = document.getElementById('new-segment-start').value
            const endDate = document.getElementById('new-segment-end').value
            const lodgingClass = document.getElementById('new-segment-lodging').value

            if (!cityId || !startDate || !endDate) {
                alert('Please fill all fields')
                return
            }

            try {
                const token = window.auth?.getJWTToken()
                const user = window.auth?.currentUser()
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }

                const response = await fetch(`${ITINERARIES_API}/itineraries/${currentItineraryId}/segments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        city_id: cityId,
                        start_date: startDate,
                        end_date: endDate,
                        lodging_class: lodgingClass,
                        user_id: user?.email || 'anonymous'
                    })
                })

                if (!response.ok) throw new Error('Failed to add segment')

                document.getElementById('add-segment-form').style.display = 'none'
                document.getElementById('new-segment-city').value = ''
                document.getElementById('new-segment-start').value = ''
                document.getElementById('new-segment-end').value = ''

                loadSegments(currentItineraryId)
                loadPricing(currentItineraryId)
                loadActivity(currentItineraryId)
            } catch (error) {
                console.error('Error adding segment:', error)
                alert('Failed to add segment')
            }
        })
    }

    const addCommentBtn = document.getElementById('add-comment-btn')
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', async () => {
            const text = document.getElementById('new-comment-text').value

            if (!text.trim()) {
                alert('Please enter a comment')
                return
            }

            try {
                const token = window.auth?.getJWTToken()
                const user = window.auth?.currentUser()
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }

                const response = await fetch(`${ITINERARIES_API}/itineraries/${currentItineraryId}/comments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: user?.email || 'anonymous',
                        comment_text: text
                    })
                })

                if (!response.ok) throw new Error('Failed to add comment')

                document.getElementById('new-comment-text').value = ''
                loadComments(currentItineraryId)
                loadActivity(currentItineraryId)
            } catch (error) {
                console.error('Error adding comment:', error)
                alert('Failed to add comment')
            }
        })
    }
})
