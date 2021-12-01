import fs from 'fs-extra'
import util from 'util'
import dayjs from 'dayjs'
import cheerio from 'cheerio'
import _ from 'lodash'
import telegraf from 'telegraf'
import axios from 'axios'

const { Telegraf } = telegraf

const TOKEN = process.env.TOKEN
const CHANNEL_ID = process.env.CHANNEL_ID
const TRENDING_URL = 'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot'
const TRENDING_DETAIL_URL = 'https://m.s.weibo.com/topic/detail?q=%s'

const bot = new Telegraf(TOKEN)

let RETRY_TIME = 5

async function saveRawJson(data) {
  const date = dayjs().format('YYYY-MM-DD')
  const fullPath = `./api/${date}.json`
  const words = data.map(o => ({
    title: o.desc,
    category: o.category,
    description: o.description,
    url: o.scheme,
    hot: o.desc_extr,
    ads: !!o.promotion
  }))
  let wordsAlreadyDownload = []
  try {
    await fs.stat(fullPath)
    const content = await fs.readFile(fullPath)
    wordsAlreadyDownload = JSON.parse(content)
  } catch (err) {
    // file not exsit
  }
  const allHots = _.uniqBy(_.concat(words, wordsAlreadyDownload), 'title')
  await fs.writeFile(fullPath, JSON.stringify(allHots))
}

async function writeMDFile() {
  const date = dayjs().format('YYYY-MM-DD')
  const fullPath = `./archives/${date}.md`
  const jsonPath = `./api/${date}.json`
  const words = await fs.readJSON(jsonPath)
  await fs.writeFile(fullPath, `# ${date} 微博热搜 \n`)
  await fs.writeFile(fullPath, words.map((item, index) => {
    return `${index + 1}. [${item.title}](${item.url}) ${item.category ? `\`${item.category?.trim()}\`` : ''} \n`
  }).join('\n'), {
    flag: 'a'
  })
}

async function sendTgMessage(data) {
  const ranks = ['🔥1.', '🔥2.', '🔥3.', '🔥4.', '🔥5.','🔥6.', '🔥7.', '🔥8.', '🔥9.', '🔥10.','🔥11.', '🔥12.', '🔥13.', '🔥14.', '🔥15.','🔥16.', '🔥17.', '🔥18.', '🔥19.', '🔥20.','🔥21.', '🔥22.', '🔥23.', '🔥24.', '🔥25.','🔥26.', '🔥27.', '🔥28.', '🔥29.', '🔥30.','🔥31.', '🔥32.', '🔥33.', '🔥34.', '🔥35.','🔥36.', '🔥37.', '🔥38.', '🔥39.', '🔥40.', '🔥41.', '🔥42.', '🔥43.', '🔥44.', '🔥45.','🔥46.', '🔥47.', '🔥48.', '🔥49.', '🔥50.', '🔥51.', '🔥52.', '🔥53.', '🔥54.', '🔥55.','🔥56.', '🔥57.', '🔥58.', '🔥59.',]
  const text = data.splice(1, 59).map((o, i) => {
  // const ranks = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']
  // const text = data.splice(1, 30).map((o, i) => {
    const containerid = encodeURIComponent(new URL(o.scheme).searchParams.get('containerid'))
    const url = `https://m.weibo.cn/search?containerid=${containerid}`
    if (o.promotion) {
      return `💰 [${o.desc}](${url}) ${(o.desc_extr / 10000).toFixed(2)} 万`
    }
    if (ranks[i]) {
      return `${ranks[i]} [${o.desc}](${url}) ${(o.desc_extr / 10000).toFixed(2)} 万`
    }
    return `🔥 [${o.desc}](${url}) ${(o.desc_extr / 10000).toFixed(2)} 万`
  })
  
  await bot.telegram.sendMessage(CHANNEL_ID, text.join('\n'), {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  })
  text.unshift(`🏄‍♂️ BFTHHOME-wbrs  ${dayjs().format('YYYY-MM-DD HH:mm:ss')} \n✅微博热搜话题🔸最新排行榜😍([查看更多](https://weibo.wbrs.me/#/hots?date=${dayjs().format('YYYY-MM-DD')})) `)

  text.unshift(`🏄‍♂️ BFTHHOME-wbrs  ${dayjs().format('YYYY-MM-DD HH:mm:ss')} \n🌈微博热搜话题🔸最新排行榜⭐️([查看更多](https://weibo.wbrs.me/#/hots?date=${dayjs().format('YYYY-MM-DD')})) `)
}

async function fetchTrendingDetail(title) {
  try {
    const { data } = await axios.get(util.format(TRENDING_DETAIL_URL, title), { timeout: 10 * 1000 })
    const $ = cheerio.load(data)
    return {
      category: $('#pl_topicband dl>dd').first().text(),
      desc: $('#pl_topicband dl:eq(1)').find('dd:not(.host-row)').last().text()
    }
  } catch {
    return {}
  }
}

async function bootstrap() {
  while (RETRY_TIME > 0) {
    try {
      const { data } = await axios.get(TRENDING_URL, { timeout: 10 * 1000 })
      if (data.ok === 1) {
        const items = data.data.cards[0]?.card_group
        if (items) {
          for (let item of items) {
            const { category, desc } = await fetchTrendingDetail(encodeURIComponent(item.desc))
            item.category = category || item.category
            item.description = desc || item.description
          }
          await saveRawJson(items)
          await writeMDFile()
          await sendTgMessage(items)
        }
      }
      RETRY_TIME = 0
    } catch (err) {
      console.log(err.message)
      RETRY_TIME -= 1
    }
  }
  process.exit(0)
}

bootstrap()
