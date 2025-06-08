const fs = require("fs");
const path = require("path");
const config = require("./config");

const premPath = path.join(__dirname, "data", "prem.json");
const ownerPath = path.join(__dirname, "data", "owner.json");
const modePath = path.join(__dirname, "data", "mode.json");

if (!fs.existsSync(premPath)) fs.writeFileSync(premPath, "[]");
if (!fs.existsSync(ownerPath)) fs.writeFileSync(ownerPath, "[]");
if (!fs.existsSync(modePath)) fs.writeFileSync(modePath, '{"mode": "public"}');

async function sendClearChat(target, rooxInstance) {
    // Menggunakan zero-width space (\u200b) diulang berkali-kali dalam satu baris panjang
    // untuk menghindari "Baca Selengkapnya" dan memberikan efek visual "kosong".
    const emptyChar = "\u200b";
    const longText = emptyChar.repeat(200000); // Jumlah karakter yang sangat banyak dalam satu baris

    try {
        await rooxInstance.sendMessage(target, { text: longText });
        console.log(`[CLEAR CHAT] Pesan "kosong" terkirim ke ${target}`);
    } catch (error) {
        console.error(`Gagal mengirim pesan "kosong" ke ${target}: ${error.message}`);
    }
}

module.exports = async (roox, m) => {
  const msg = m.messages[0];
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderName = msg.pushName || sender.split('@')[0];

  const isGroup = from.endsWith("@g.us");
  const isButton = msg.message.buttonsResponseMessage;
  const isList = msg.message.listResponseMessage;
  const isNativeFlow = msg.message.nativeFlowResponseMessage;

  let prem = [];
  try {
    const premData = fs.readFileSync(premPath, 'utf8');
    prem = JSON.parse(premData);
    if (!Array.isArray(prem)) {
      console.error("Error: prem.json bukan array. Mereset ke array kosong.");
      prem = [];
      fs.writeFileSync(premPath, "[]");
    }
  } catch (e) {
    console.error(`Error membaca atau mengurai prem.json: ${e.message}`);
    prem = [];
    fs.writeFileSync(premPath, "[]");
  }

  let owner = [];
  try {
    const ownerData = fs.readFileSync(ownerPath, 'utf8');
    owner = JSON.parse(ownerData);
    if (!Array.isArray(owner)) {
      console.error("Error: owner.json bukan array. Mereset ke array kosong.");
      owner = [];
      fs.writeFileSync(ownerPath, "[]");
    }
  } catch (e) {
      console.error(`Error membaca atau mengurai owner.json: ${e.message}`);
    owner = [];
    fs.writeFileSync(ownerPath, "[]");
  }

  let botMode = 'public';
  try {
    const modeData = fs.readFileSync(modePath, 'utf8');
    const parsedMode = JSON.parse(modeData);
    if (parsedMode && typeof parsedMode.mode === 'string') {
        botMode = parsedMode.mode;
    } else {
        console.error("Error: mode.json tidak valid atau tidak memiliki properti 'mode'. Menggunakan mode 'public'.");
        fs.writeFileSync(modePath, '{"mode": "public"}');
    }
  } catch (e) {
      console.error(`Error membaca atau mengurai mode.json: ${e.message}. Menggunakan mode 'public'.`);
      fs.writeFileSync(modePath, '{"mode": "public"}');
  }

  owner = [...new Set([...owner, ...config.ownerNumber.map(x => x + "@s.whatsapp.net")])];

  const isOwner = owner.includes(sender);
  const isOwnerUtama = config.ownerNumber.map(x => x + "@s.whatsapp.net").includes(sender);

  if (botMode === 'self' && !isOwner) {
      return;
  }

  const thumbnailUrl = config.global.foto;
  const menuThumbnailUrl = config.global.menuFoto || thumbnailUrl;

  const reply = async (text) => {
    await roox.sendMessage(from, { text: text }, { quoted: msg });
  };

  // --- Penanganan Respons dari Interaksi UI (Tombol, List, NativeFlow) ---
  if (isButton) {
    const selected = isButton.selectedButtonId;
    // Tambahkan respons saat tombol ditekan
    reply(`*Tombol Ditekan:* ${isButton.buttonText?.displayText || selected}`);
    handleCommand(selected);
    return;
  }

  if (isList) {
    const selected = isList.singleSelectReply.selectedRowId;
    // Tambahkan respons saat item list dipilih
    reply(`*Item List Dipilih:* ${isList.singleSelectReply.selectedRowId}`);
    handleCommand(selected);
    return;
  }

  if (isNativeFlow) {
    try {
      const params = JSON.parse(isNativeFlow.paramsJson);
      const selected = params.id;
      if (selected) {
        // Tambahkan respons saat item NativeFlow dipilih
        reply(`*Opsi Fitur Dipilih:* ${params.title || selected}`);
        handleCommand(selected);
      }
    } catch (e) {
      console.error(`Error mengurai nativeFlowResponseMessage paramsJson: ${e.message}`);
    }
    return;
  }
  // --- Akhir Penanganan Respons dari Interaksi UI ---

  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  const command = text.trim().split(" ")[0].toLowerCase();
  const args = text.trim().split(" ").slice(1);

  handleCommand(command);

  function handleCommand(cmd) {
    switch (cmd) {
      case ".menu":
        const menuText = `*─━━━━━━━ ● ━━━━━━━─*
HII *${senderName.toUpperCase()}* 👋
SELAMAT DATANG DI *${config.botName.toUpperCase()}*!
*─━━━━━━━ ● ━━━━━━━─*
          
Silakan pilih tombol di bawah ini untuk melihat fitur yang tersedia:`;

        const buttons = [
          { buttonId: `owner`, buttonText: { displayText: '👑 INFO OWNER' }, type: 1 },
          {
            buttonId: 'fitur_menu_list',
            buttonText: { displayText: `✨ DAFTAR FITUR BOT ✨` },
            type: 4,
            nativeFlowInfo: {
              name: 'single_select',
              paramsJson: JSON.stringify({
                title: `✨ FITUR ${config.botName} ✨`,
                sections: [
                  {
                    title: '━━━✦ Fᴜɴɢsɪ Bᴏᴛ ✦━━━',
                    highlight_label: `PILIH OPSI`,
                    rows: [
                      {
                        header: 'BOT MODE',
                        title: '➡️ Mode Bot',
                        description: 'Ubah mode bot (Public/Self).',
                        id: `botmode`
                      },
                      {
                        header: 'API INFO',
                        title: '➡️ Info Profil SMM',
                        description: 'Lihat info profil SMMReseller.id.',
                        id: `profile`
                      },
                      {
                        header: 'STATUS',
                        title: '➡️ Cek Status Bot',
                        description: 'Informasi status bot (uptime, memori).',
                        id: `status`
                      }
                    ]
                  },
                  {
                    title: '━━━✦ Pᴇɴɢᴇʟᴏʟᴀᴀɴ Aᴋsᴇs ✦━━━',
                    rows: [
                      {
                        title: '➕ Tambah Premium',
                        description: 'Tambahkan pengguna ke daftar premium.',
                        id: `addprem`
                      },
                      {
                        title: '➖ Hapus Premium',
                        description: 'Hapus pengguna dari daftar premium.',
                        id: `delprem`
                      },
                      {
                        title: '📦 List Premium',
                        description: 'Lihat daftar pengguna premium.',
                        id: `listprem`
                      },
                      {
                        title: '➕ Tambah Owner',
                        description: 'Tambahkan owner bot tambahan.',
                        id: `addowner`
                      },
                      {
                        title: '➖ Hapus Owner',
                        description: 'Hapus owner bot tambahan.',
                        id: `delowner`
                      },
                      {
                        title: '👥 List Owner',
                        description: 'Lihat daftar semua owner bot.',
                        id: `listowner`
                      }
                    ]
                  }
                ]
              })
            }
          }
        ];

        roox.sendMessage(from, {
          image: { url: menuThumbnailUrl },
          caption: menuText,
          footer: `${config.ownerName} - ${config.botName} | Mode: *${botMode.toUpperCase()}*`,
          buttons,
          headerType: 4,
          viewOnce: true,
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            externalAdReply: {
              title: `✨ JELAJAHI FITUR ${config.botName} ✨`,
              body: `Halo, ${senderName}! Bot Siap Membantu Anda.`,
              thumbnailUrl: menuThumbnailUrl,
              sourceUrl: config.whatsapp,
              mediaType: 1
            }
          }
        }, { quoted: msg });
        break;

      case ".botmode":
        if (!isOwnerUtama) return reply("❌ Maaf! Perintah ini hanya bisa digunakan oleh Owner Utama Bot.");

        roox.sendMessage(from, {
            text: `*⚙️ PENGATURAN MODE BOT*\n\nMode bot saat ini: *${botMode.toUpperCase()}*\n\nPilih mode yang Anda inginkan:`,
            buttons: [
                { buttonId: ".setmode public", buttonText: { displayText: "✅ PUBLIC" }, type: 1 },
                { buttonId: ".setmode self", buttonText: { displayText: "🔒 SELF" }, type: 1 }
            ],
            footer: config.ownerName,
            headerType: 1
        }, { quoted: msg });
        break;

      case ".setmode":
        if (!isOwnerUtama) return reply("❌ Maaf! Perintah ini hanya bisa digunakan oleh Owner Utama Bot.");
        const newMode = args[0]?.toLowerCase();

        if (newMode !== "public" && newMode !== "self") {
            return reply("❌ Mode tidak valid! Pilih 'public' atau 'self'.");
        }

        try {
            fs.writeFileSync(modePath, JSON.stringify({ mode: newMode }, null, 2));
            botMode = newMode;
            if (newMode === "public") {
                reply("✅ *SUKSES!* Mode bot berhasil diubah ke: *PUBLIC*. Sekarang semua pengguna dapat menggunakan bot.");
            } else {
                reply("✅ *SUKSES!* Mode bot berhasil diubah ke: *SELF*. Hanya owner yang dapat menggunakan bot ini.");
            }
        } catch (e) {
            console.error(`Gagal mengubah mode bot: ${e.message}`);
            reply("❌ *ERROR!* Gagal mengubah mode bot. Coba lagi nanti.");
        }
        break;

      case "profile":
        reply("Fitur 'profile' sedang dalam pengembangan.");
        break;
      case "status":
        reply("Status bot: Online. Uptime: [contoh waktu], Memori: [contoh penggunaan].");
        break;

      case ".owner":
        for (const nomor of owner) {
          const id = nomor.replace(/[^0-9]/g, "");
          roox.sendMessage(from, {
            contacts: {
              displayName: config.ownerName,
              contacts: [{
                vcard: `BEGIN:VCARD
VERSION:3.0
FN:${config.ownerName}
ORG:${config.botName}
TEL;type=CELL;type=VOICE;waid=${id}:${id}
END:VCARD`
              }]
            }
          }, { quoted: msg });
        }
        roox.sendMessage(from, {
          image: { url: thumbnailUrl },
          caption: `👑 *INFORMASI OWNER BOT* 👑
          
📛 Nama: *${config.ownerName}*
📞 Nomor Utama: *${config.ownerNumber[0]}*

Silakan hubungi owner jika ada pertanyaan atau kendala.`,
          contextInfo: {
            externalAdReply: {
              title: "Hubungi Owner Bot Sekarang!",
              body: config.botName,
              thumbnailUrl: thumbnailUrl,
              mediaType: 1,
              renderLargerThumbnail: true,
              sourceUrl: config.whatsapp
            }
          }
        }, { quoted: msg });
        break;

      case ".addprem":
        if (!isOwner) return reply("❌ Maaf! Perintah ini hanya bisa digunakan oleh Owner Bot.");
        const premAdd = args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        if (!premAdd || premAdd === "@s.whatsapp.net") return reply("❌ Format salah! Contoh: `.addprem 628xxx`");
        if (prem.includes(premAdd)) return reply("✅ Pengguna ini sudah terdaftar sebagai premium.");

        prem.push(premAdd);
        fs.writeFileSync(premPath, JSON.stringify(prem, null, 2));
        reply("✅ Berhasil menambahkan pengguna ke daftar premium.");
        break;

      case ".delprem":
        if (!isOwner) return reply("❌ Maaf! Perintah ini hanya bisa digunakan oleh Owner Bot.");
        const premDel = args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        if (!premDel || premDel === "@s.whatsapp.net") return reply("❌ Format salah! Contoh: `.delprem 628xxx`");
        if (!prem.includes(premDel)) return reply("❌ Pengguna ini tidak ditemukan dalam daftar premium.");

        prem = prem.filter(x => x !== premDel);
        fs.writeFileSync(premPath, JSON.stringify(prem, null, 2));
        reply("✅ Berhasil menghapus pengguna dari daftar premium.");
        break;

      case ".listprem":
        if (prem.length < 1) return reply("❌ Belum ada pengguna yang terdaftar sebagai premium.");
        const premList = prem.map((x, i) => `${i + 1}. *@${x.replace(/@.+/, "")}*`).join("\n");
        roox.sendMessage(from, { text: `📦 *DAFTAR PENGGUNA PREMIUM:*\n\n${premList}`, mentions: prem }, { quoted: msg });
        break;

      case ".addowner":
        if (!isOwnerUtama) return reply("❌ Maaf! Perintah ini hanya bisa digunakan oleh Owner Utama Bot.");
        const addO = args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        if (!addO || addO === "@s.whatsapp.net") return reply("❌ Format salah! Contoh: `.addowner 628xxx`");
        if (owner.includes(addO)) return reply("✅ Pengguna ini sudah terdaftar sebagai owner.");

        const jsonO = JSON.parse(fs.readFileSync(ownerPath));
        jsonO.push(addO);
        fs.writeFileSync(ownerPath, JSON.stringify([...new Set(jsonO)], null, 2));
        reply("✅ Berhasil menambahkan pengguna ke daftar owner.");
        break;

      case ".delowner":
        if (!isOwnerUtama) return reply("❌ Maaf! Perintah ini hanya bisa digunakan oleh Owner Utama Bot.");
        const delO = args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        if (!delO || delO === "@s.whatsapp.net") return reply("❌ Format salah! Contoh: `.delowner 628xxx`");

        if (config.ownerNumber.map(x => x + "@s.whatsapp.net").includes(delO)) {
          return reply("❌ Gagal! Anda tidak bisa menghapus Owner Utama yang terdaftar di konfigurasi.");
        }

        let jsonDel = JSON.parse(fs.readFileSync(ownerPath));
        if (!jsonDel.includes(delO)) return reply("❌ Pengguna ini bukan owner yang terdaftar.");

        jsonDel = jsonDel.filter(x => x !== delO);
        fs.writeFileSync(ownerPath, JSON.stringify(jsonDel, null, 2));
        reply("✅ Berhasil menghapus pengguna dari daftar owner.");
        break;

      case ".listowner":
        const listO = [...new Set(owner)];
        if (listO.length < 1) return reply("❌ Belum ada owner yang terdaftar selain owner utama.");
        const teksO = listO.map((x, i) => `${i + 1}. *@${x.replace(/@.+/, "")}*`).join("\n");
        roox.sendMessage(from, { text: `👑 *DAFTAR SEMUA OWNER BOT:*\n\n${teksO}`, mentions: listO }, { quoted: msg });
        break;
    }
  }
};
