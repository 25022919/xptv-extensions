const fs = require('fs')
const os = require('os')
const axios = require('axios')
const fetch = require('node-fetch')
const CryptoJS = require('crypto-js')

// 測試時忽略證書驗證
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

let cachesPath = `${os.homedir()}/Documents/caches`

let appConfig = {
    ver: 1,
    title: '星芽短劇',
    site: 'https://app.whjzjx.cn',
    tabs: [
        {
            name: '热播剧',
            ext: {
                id: 2,
            },
        },
        {
            name: '会员专享',
            ext: {
                id: 8,
            },
        },
        {
            name: '星选好剧',
            ext: {
                id: 7,
            },
        },
        {
            name: '新剧',
            ext: {
                id: 3,
            },
        },
        {
            name: '阳光剧场',
            ext: {
                id: 5,
            },
        },
    ],
}

function getConfig() {
    return appConfig
}

async function getCards(ext) {
    let cards = []
    let { id, page = 1 } = ext
    let url = `${appConfig.site}/cloud/v2/theater/home_page?theater_class_id=${id}&type=1&page_num=${page}&page_size=24`
    let headers = await getHeader()

    const { data } = await axios.get(url, {
        headers: headers,
    })

    let list = data.data.list
    list.forEach((e) => {
        let item = e.theater
        let id = item.id.toString()
        cards.push({
            vod_id: id,
            vod_name: item.title,
            vod_pic: item.cover_url,
            vod_remarks: `${item.total}集全`,
            ext: {
                id,
            },
        })
    })

    return {
        list: cards,
    }
}

async function getTracks(ext) {
    let tracks = []
    let id = ext.id
    let url = `${appConfig.site}/v2/theater_parent/detail?theater_parent_id=${id}`
    let headers = await getHeader()

    const { data } = await axios.get(url, {
        headers: headers,
    })

    let playlist = data.data.theaters
    playlist.forEach((e) => {
        let name = e.num.toString()
        let url = e.son_video_url
        tracks.push({
            name,
            pan: '',
            ext: {
                url,
            },
        })
    })

    return {
        list: [
            {
                title: '默认分组',
                tracks,
            },
        ],
    }
}

async function getPlayinfo(ext) {
    let url = ext.url

    return { urls: [url] }
}

async function search(ext) {
    let cards = []

    let text = ext.text
    let url = appConfig.site + '/v3/search'
    let headers = await getHeader()
    headers['Content-Type'] = 'application/json'
    let body = {
        text: encodeURIComponent(text),
    }

    // const { data } = await axios.post(url, body, {
    //     headers: headers,
    // })
    const resp = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
    })
    const data = await resp.json()

    const list = data.data.theater.search_data

    list.forEach((e) => {
        let item = e
        let id = item.id.toString()
        cards.push({
            vod_id: id,
            vod_name: item.title,
            vod_pic: item.cover_url,
            vod_remarks: `${item.total}集全`,
            ext: {
                id,
            },
        })
    })

    return {
        list: cards,
    }
}

async function getHeader() {
    let header = {
        'User-Agent': 'okhttp/4.10.0',
        'Accept-Encoding': 'gzip',
        'x-app-id': '7',
        platform: '1',
        manufacturer: 'asus',
        version_name: '3.3.1',
        user_agent:
            'Mozilla/5.0 (Linux; Android 14; Zenfone 5Z Build/AP2A.240705.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36',
        dev_token:
            'Bsg4gWzOoQc9UEvsnDHZWNlpphiWxQ9MIDNUZIqU6k_irRIWCyYEABtuSI5OBkJ9gDNLzcr1wBQSku05JgYmeQN-lmGn94m-On-JSrqecxcFQdU8VkskVkugV4qUF_mW1sHjcYWeXbfdHM5b2VytKSUCRzlJ-Ix4QuRrll15Rmxo*',
        app_version: '3.3.1',
        device_platform: 'android',
        personalized_recommend_status: '1',
        device_type: 'Zenfone+5Z',
        device_brand: 'asus',
        os_version: '14',
        channel: 'default',
        raw_channel: 'default',
        oaid: '',
        msa_oaid: '',
        uuid: 'randomUUID_9e91d3ce-8658-4d6e-9d1b-6f351611163d',
        device_id: '2885ce2d34c9634b287ab022f2f3a6cfb',
        ab_id: '',
        support_h265: '1',
    }
    let tokenPath = `${cachesPath}/xingya-token.txt`
    let token = null
    if (!fs.existsSync(tokenPath)) {
        token = await getJWT(header)
        fs.writeFileSync(tokenPath, token, 'utf-8')
    } else {
        token = fs.readFileSync(tokenPath, 'utf-8')
        let currentTime = Math.floor(Date.now() / 1000)
        let exp = decodeJWT(token).payload.exp

        if (currentTime > exp) {
            // token expired
            token = await getJWT(header)
            fs.writeFileSync(tokenPath, token, 'utf-8')
        }
    }
    header['authorization'] = token
    return header
}

async function getJWT(header) {
    const login = `https://u.shytkjgs.com/user/v1/account/login`
    let headers = header
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const body = `device=${headers.device_id}`

    // const res = await axios.post(login, body, {
    //     headers: headers,
    // })
    const res = await fetch(login, {
        method: 'POST',
        headers: headers,
        body: body,
    })
    const jwt = (await res.json()).data.token
    return jwt
}

function decodeJWT(token) {
    function base64UrlDecode(str) {
        // Replace URL-safe characters with Base64 characters
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
        // Add padding if necessary
        while (base64.length % 4) {
            base64 += '='
        }
        // Decode Base64 string
        return base64Decode(base64)
    }

    // Split JWT into parts
    const parts = token.split('.')
    if (parts.length !== 3) {
        throw new Error('Invalid JWT token')
    }

    // Decode header and payload
    const header = JSON.parse(base64UrlDecode(parts[0]))
    const payload = JSON.parse(base64UrlDecode(parts[1]))

    return {
        header: header,
        payload: payload,
        signature: parts[2],
    }
}

function base64Decode(text) {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text))
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search }