# Speech-to-text for mixed Urdu and English sales calls

Researched 13 Nov 2026. Covers the call bot's per-speaker, per-utterance transcripts (energy VAD, so no diarization needed). Every number below has a source link. Each one is labelled **[published]** (vendor or paper benchmark), **[third-party]** (independent benchmark), **[vendor claim]** (marketing page without a method) or **[anecdotal]** (forum post or our own test).

## Answer

No public benchmark covers our exact case: Pakistani-accented Urdu that switches into English inside a sentence, over video calls. So the decision has to come from an A/B test on our own calls. The research does narrow the field a lot.

- **Do not move up to gpt-4o-transcribe.** Azure's retirement schedule lists the 2025-03-20 version with a retirement date of 2026-10-15, which has already passed. OpenAI shuts down its whole gpt-4o-transcribe family, and whisper-1, on 2027-02-26.
- **Whisper on Azure retires on 2026-12-15.**
- **gpt-4o-mini-transcribe (2025-12-15) can stay as a stopgap only.** It is supported on Azure until 2027-06-15. The one independent Urdu benchmark we found puts "GPT-4o Mini Transcribe" at 50.0% OI-WER (word error rate that accepts spelling variants). On the same set, Microsoft's real-time recognizer scored 17.2% and Gemini 3 Pro 6.7%. That set is Indian telephone Urdu, not our audio.
- **Two candidates on Azure are worth testing:**
  - **gpt-transcribe**: OpenAI's successor model, on Azure Global Standard at $0.27/h. It takes several language hints plus keywords, built for code-switching.
  - **MAI-Transcribe-2**: Microsoft's own model in Azure Speech. It lists Urdu among its 60 languages, does code-switching automatically, takes a phrase list, is served from Central India, and costs $0.10/h on a promo until 31 Dec 2026.

  Both should be A/B tested against today's Azure Speech `ur-IN` + `en-GB` setup on 100–200 real utterances.

Whisper large-v3 self-hosted is the best-documented open fallback. On conversational Urdu recorded over internet calls by speakers in Pakistan (LUMS study) it scored 18.3% WER. It has known risks: hallucination, and writing Urdu in Hindi script.

## Comparison table

Prices are USD per hour of audio sent, pay-as-you-go. "On Azure?" means it can run inside our Azure subscription.

| Option | Urdu accuracy (source) | Code-switching | Output script | Price / audio hour | On Azure? | Notes |
|---|---|---|---|---|---|---|
| **Azure AI Speech real-time**, `ur-IN` + `en-GB`, continuous language ID (current) | Microsoft publishes no Urdu WER. **[third-party]** "Microsoft Realtime" 17.2%, "Microsoft Speech-to-Text" 23.1% OI-WER on Indian telephone Urdu ([JoshTalks][jt]); model versions not stated | **Not within a sentence.** The docs say continuous LID "doesn't support changing languages within the same sentence" ([MS LID][lid]) | Urdu (Perso-Arabic) for `ur-IN`, Latin for `en-GB`. A mixed sentence comes out wholly in one locale's script | Real-time $1.00 + continuous LID add-on $0.30; batch $0.18; fast transcription $0.36 (Central India, [Azure retail prices][arp]) | Yes, GA. No `ur-PK` locale ([MS lang][lang]) | `ur-IN` custom speech accepts **labeled audio only**. No phrase list or plain-text adaptation is listed for `ur-IN` (Hindi has both) ([MS lang][lang]). So "فلیٹ → فلگ" can only be fixed by training on audio plus human transcripts. Custom: real-time $1.20/h, hosting $0.05375/h (~$39/month), training $10 per compute hour ([arp]) |
| **Azure LLM Speech** (fast transcription "enhanced mode") | Not published | Multilingual, automatic language detection ([MS LLM Speech][llm]); code-switching not stated | Not stated | Not in the retail price API at time of writing | Yes (`ur-IN` listed for LLM Speech, [lang]) | Phrase list ✅. Prompt is for output formatting only ([llm]) |
| **MAI-Transcribe-2** (Azure Speech fast transcription) | **[vendor claim]** 5.2% average FLEURS WER across 60 languages, no per-language Urdu figure in the model card ([MAI-2 card][mai2card]). No third-party Urdu number found | **Automatic** "for commonly blended language pairs such as Hinglish and Spanglish" ([MS MAI][mai]). Urdu–English is not named | Not stated. Returns a `locale` per segment ([mai2card]) | $0.10 promo until 2026-12-31 ([mai2card], [Azure pricing][azp]). The retail API also shows a "MAI-Transcribe-2 Audio" meter at $0.54/h ([arp]); which one applies after the promo is unclear | Yes. Served from East US, West US, West US2, North Europe, **Central India**, Southeast Asia ([mai2card]). Urdu is MAI-Transcribe-**2** only, not 1.5 ([mai]) | Phrase list (keyword biasing), `verbatim` style for records, file ≤300 MB / 2 h. Released 2026-09-03 |
| **gpt-4o-mini-transcribe 2025-12-15** (implemented, not enabled) | **[third-party]** 50.0% OI-WER Urdu ([JoshTalks][jt]); snapshot not stated. **[published]** OpenAI: lower WER than earlier models on CV/FLEURS, no Urdu figure ([OpenAI update][oaiupd]) | Prompt can describe the mix. No published code-switch metric | Follows the prompt in our setup; no published wrong-script rate | ≈$0.18 (OpenAI $0.003/min, [OpenAI pricing][oaip]). Azure bills tokens: $3 per 1M audio-in tokens on Global ([arp]) | Yes. Global Standard ✅. Azure **retires it 2027-06-15** ([MS retire][ret]). OpenAI API shutdown 2027-02-26 ([OpenAI deprec][dep]) | OpenAI: ~90% fewer hallucinations than Whisper v2 and ~70% fewer than earlier gpt-4o-transcribe on its noise/silence test ([oaiupd]). Azure's model page still tags this version "Preview" while the retirement page says GA ([MS models][models]) |
| **gpt-4o-transcribe** | Per-language FLEURS chart is an image in OpenAI's launch post; the page returned 403 and we couldn't read the Urdu value. **Not found** | Prompting | Not stated | ≈$0.36 ($0.006/min, [oaip]) | Azure 2025-03-20 version **retirement 2026-10-15 (passed)** ([ret]). OpenAI shutdown 2027-02-26 ([dep]) | **Don't adopt.** It is on its way out on both platforms |
| **gpt-transcribe** (successor, released 2026-07-28) | **Not published** for Urdu (model page makes no benchmark claims, [gpt-transcribe][gptt]) | Built for it: "multiple language hints to improve transcription of … multilingual audio, and code-switching" ([gptt]). `languages` list replaces `language` ([OpenAI STT][stt]) | Not stated | $0.27 ($0.0045/min, [gptt]). Azure: Global $0.27, Data Zone $0.297 ([arp]) | Yes. Global Standard in Canada Central, Central US, East US 2, West US 3, France Central, Sweden Central, South India, UAE North ([MS regions][reg]). No retirement date listed yet ([ret]) | Also takes `keywords` (hints, not forced) plus free-form `prompt` ([stt]). Offline `/audio/transcriptions` model ([models]). The live variant `gpt-live-transcribe` is $1.02/h on Azure ([arp]) |
| **Whisper large-v2 / large-v3 / turbo** (OpenAI `whisper-1`, Azure `whisper`, or self-hosted) | **[published]** FLEURS ur: large-v2 **22.6%**, large 25.0%, medium 28.2%. Common Voice 9 ur: large-v2 **24.2%** (Whisper paper, Tables 11 and 13, [Radford et al.][wp]). Turbo: FLEURS **21.9%**, CV15 26.5% (maintainer reply, [turbo][turbo]). **[third-party]** large-v3 on Urdu internet-call conversations from Pakistan: **18.30%** WER zero-shot ([Arif et al. 2024][wws]). **[vendor claim]** ElevenLabs lists Whisper large-v3 at 46.6% FLEURS Urdu ([EL Urdu][elur]), which conflicts with OpenAI's figures (likely different text normalization) | Not trained for it. One `language` token per 30 s window | Can write Hindi audio in Urdu script and the reverse; Hindi/Urdu confusion is a known issue (**[anecdotal]** [whisper #1662][w1662], [#2761][w2761]). Fix: pass `language="ur"` and/or an Urdu-script prompt | whisper-1 ≈$0.36 ([oaip]). Azure batch Whisper $0.36 global ([arp]). Self-hosted: GPU cost only | Azure `whisper` 001 **retires 2026-12-15** ([ret]). whisper-1 shutdown 2027-02-26 ([dep]). Self-hosted has no retirement | Paper: "repeat loops… or complete hallucination" ([wp] §6). Prompt ≤224 tokens, not instruction-following ([stt]). Turbo is not trained for translation ([turbo]) |
| **Urdu fine-tuned Whisper** (Hugging Face) | **[published, self-reported]** `kingabzpro/whisper-large-v3-urdu` CV17 test **26.02%**; `…-turbo-urdu` 26.23% ([HF v3][hfv3], [HF turbo][hft]). Fine-tuning large-v3 on CV+FLEURS: conversational 18.30 → 17.86% ([wws]) | Fine-tunes on monolingual Urdu read speech; nothing published on English code-switching | Urdu | GPU cost only | Self-host only (Azure ML / VM) | Gains are small on conversational audio ([wws]). Bigger risk is losing English ability (our inference, not measured) |
| **Google Chirp 2 / Chirp 3** | **Not found** (no per-language Urdu WER in Chirp docs) | Chirp 3 accepts several expected locales and "infers and transcribes in the most prevalent language" ([Chirp 3][chirp3]); code-switching not stated | Urdu (`ur-PK` exists) | Standard $0.016/min = $0.96; dynamic batch $0.003/min = $0.18 (Google pricing page via search snippet, [GCP pricing][gcpp]) | No (Google Cloud). `ur-PK` for chirp/chirp_2 in asia-southeast1 and europe-west4, chirp_3 in `eu` ([GCP langs][gcpl]) | Model adaptation listed for chirp_2 `ur-PK` ([gcpl]) |
| **Gemini 3 Pro / Flash** (LLM transcription) | **[third-party]** 6.7% / 10.8% OI-WER Urdu, 0.0% wrong-script for Pro ([JoshTalks][jt]) | Not measured separately | Perso-Arabic (0% wrong script, [jt]) | Not researched | No | Best Urdu number we found. Being a general LLM, it can paraphrase or "fix" speech, which is a risk for a verbatim record (not measured) |
| **ElevenLabs Scribe v2 / v3** | **[published]** Scribe v2 Urdu is in the "Moderate (>25% to ≤50% WER)" band ([EL docs][eld]). **[vendor claim]** v1 14.4% FLEURS; "3.1% FLEURS / 5.5% CV" with no version named ([EL Urdu][elur]). **[third-party]** v2 17.9% OI-WER, with 6.95% of Urdu rows in Devanagari script ([jt]) | v3 "secondary languages for mixed-language audio"; v3 Live "multilingual mode for mid-sentence language switches" ([eld], [EL v3][elv3]) | Mostly Urdu; known Devanagari leakage on v2 ([jt]) | v3 $0.20 + keyterms $0.05 ([EL pricing][elp]) | No | Up to 1,000 keyterms ([eld]). Scribe v3 is three days old (2026-11-10); no Urdu data for it yet |
| **Deepgram Nova-3** | **[vendor claim]** ElevenLabs lists Deepgram Nova 2 at 100% FLEURS Urdu ([elur]) | `ur` is in **monolingual** Nova-3 only, not the multilingual model ([DG][dg]) | Urdu | $0.0043/min = $0.26; multilingual $0.31 ([DG pricing][dgp]) | No | Not suitable: no Urdu in code-switching mode |
| **AssemblyAI Universal-2 / 3.6 Pro Preview** | **[published]** Universal-2 Urdu in "Good (>10% to ≤25% WER)" band; Urdu also in Universal-3.6 Pro Preview ([AAI][aai]) | Not documented for Urdu | Not stated | Universal-2 $0.15 (+$0.05 keyterms) ([AAI pricing][aaip]) | No | |

## Recommendation for our case

Our case: transcripts after the call, mixed Urdu and English, each speaker's audio separate, utterances already cut by VAD.

1. **Don't switch to gpt-4o-transcribe or Whisper on Azure.** Both are past or near their retirement dates on Azure (2026-10-15 and 2026-12-15).
2. **Don't make gpt-4o-mini-transcribe the default yet.** Our code (`services/call-bot/index.mjs`) already sends a good prompt with terms like "flat" and "Write Urdu in Urdu script". But the only independent Urdu number for it is weak (50.0% vs 17.2% for Microsoft real-time). And it retires on Azure on 2027-06-15. If we enable it, it is a trial arm, not the final choice.
3. **Run a four-way A/B test on our own audio.** Each candidate is a small change to `transcribeClip`, since all take a WAV per utterance over REST:
   - **A. Current:** Azure Speech real-time, `en-GB` + `ur-IN`, continuous LID.
   - **B. gpt-4o-mini-transcribe 2025-12-15** with the current prompt (already built).
   - **C. gpt-transcribe** on Azure Global Standard, with `languages: ["ur","en"]`, our domain words in `keywords`, and the call context in `prompt`. This is the OpenAI line's successor and the most direct code-switching support.
   - **D. MAI-Transcribe-2** through Azure Speech fast transcription (`enhancedMode.model = "MAI-Transcribe-2"`), with no `locales` so code-switching stays on, `phraseList` with our domain words, and `transcribeStyle: "verbatim"`. It is served from Central India, the same region as our DB.
   - Optional external control if data-residency rules allow: Gemini 3 Pro or ElevenLabs Scribe v3. This tells us how far the Azure options are from the best Urdu result we found.
4. **Test set.** Use 100–200 utterances from real calls, from both agents and clients, with background noise, and some clips that are silence or noise only. The ideal is 30–60 minutes in total. A bilingual person writes the reference transcript under one fixed rule: Urdu words in Urdu script, English words in Latin script, as our prompt asks.
5. **What to measure:**
   - WER and CER after Urdu text normalization (unify ی/ي, ک/ك, ہ/ة, strip diacritics). Arif et al. show raw WER is distorted by spelling variants.
   - Wrong-script rate: Devanagari output, or Roman Urdu where Urdu script was expected.
   - Domain-term accuracy on a fixed list: flat, plot, villa, apartment, bedroom, payment plan, handover, dirham, project and developer names.
   - English words kept in English and not translated or transliterated.
   - Hallucination rate on the silence/noise clips.
   - Latency per utterance and cost per call hour.
6. **Decision rule.** Pick the cheapest option within about 2 points of the best normalized WER, with zero hallucinations on the silence set and correct script. Then put its retirement date in `internal-details/future-plans/` so we hear about it before Azure does it for us.
7. **If Azure Speech `ur-IN` wins on accuracy:** the only way to fix domain words like فلیٹ for Urdu is custom speech trained on labeled audio (audio plus human transcripts). Phrase lists are not listed for `ur-IN`. A phrase list on the `en-GB` side won't help when the word is spoken inside an Urdu sentence.

## Risks

- **No benchmark matches our audio.** All Urdu numbers are FLEURS/Common Voice (read speech), Indian telephone Urdu (JoshTalks), or a 1.3-hour LUMS call set. None measures Urdu–English switching inside a sentence. Only our own A/B test settles it.
- **Third-party report caveats.** The JoshTalks report is a **draft** (V2, Aug 2026), hosted on an `elevenlabsreport.*` subdomain with no funding disclosure, and it names no model versions or locales. Treat its numbers as directional.
- **Retirement churn.** gpt-4o-transcribe (Azure, passed), Whisper on Azure (2026-12-15), the whole OpenAI gpt-4o-transcribe line and whisper-1 (2027-02-26), and gpt-4o-mini-transcribe on Azure (2027-06-15) all expire soon. Preview models on Azure can be force-upgraded or retired with 30 days' notice ([MS lifecycle][life]).
- **MAI-Transcribe-2 price after 2026.** The $0.10/h is a promo until 2026-12-31. The retail API also lists a $0.54/h meter. Budget at $0.54/h until Microsoft confirms.
- **Script errors.** Whisper-family and ElevenLabs v2 models can write Urdu in Devanagari or mix up Hindi and Urdu. Check the output script automatically: flag any Devanagari characters.
- **Hallucination on non-speech.** Whisper is documented to hallucinate. Our VAD drops silence, but noise bursts over 300 ms still go through. Include noise-only clips in the test.
- **LLM-style transcribers may "clean up" speech** (paraphrase, translate English to Urdu or the reverse, fix grammar). That is bad for a record of who said what. Use verbatim modes where offered, and check English-word preservation in the A/B.
- **Region and data residency.** gpt-transcribe Global Standard routes globally. The Global Standard regions near us are South India and UAE North. ElevenLabs, Google, Deepgram and AssemblyAI take audio outside Azure.
- **Cost doubling.** We send each speaker separately, so audio hours per call are roughly the number of speakers times the call length (minus silence the VAD removes).

## Sources

- [wp]: Radford et al., *Robust Speech Recognition via Large-Scale Weak Supervision* (Whisper paper), Tables 11 (CommonVoice9) and 13 (FLEURS), §6 limitations: https://arxiv.org/abs/2212.04356 (HTML: https://ar5iv.labs.arxiv.org/html/2212.04356, PDF: https://cdn.openai.com/papers/whisper.pdf)
- [turbo]: openai/whisper discussion #2363, large-v3-turbo announcement; jongwook: "Turbo scored 26.5% (CV15) and 21.9% (FLEURS) on Urdu": https://github.com/openai/whisper/discussions/2363
- large-v3 announcement (10–20% fewer errors than v2, chart only): https://github.com/openai/whisper/discussions/1762
- [w1662]: Whisper writing Hindi audio in Arabic/Persian script: https://github.com/openai/whisper/discussions/1662
- [w2761]: whisper-1 on Indian-context audio (Hinglish written in Devanagari): https://github.com/openai/whisper/discussions/2761
- [wws]: Arif et al., *WER We Stand: Benchmarking Urdu ASR Models* (LUMS, 2024): https://arxiv.org/html/2409.11252v1
- [dep]: OpenAI deprecations (notice 2026-08-26, shutdown 2027-02-26, replacement gpt-live-transcribe / gpt-transcribe): https://developers.openai.com/docs/deprecations
- [oaip]: OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- [gptt]: gpt-transcribe model page: https://developers.openai.com/api/docs/models/gpt-transcribe
- [stt]: OpenAI speech-to-text guide (`languages`, `keywords`, prompt, whisper-1 224-token prompt): https://developers.openai.com/api/docs/guides/speech-to-text and https://developers.openai.com/api/docs/guides/transcription
- [oaiupd]: OpenAI "Updates for developers building with voice" (gpt-4o-mini-transcribe-2025-12-15: ~90% / ~70% fewer hallucinations): https://developers.openai.com/blog/updates-audio-models
- gpt-4o-transcribe launch post (FLEURS per-language chart; returned 403 to our fetcher, Urdu value not read): https://openai.com/index/introducing-our-next-generation-audio-models/
- [ret]: Microsoft Foundry model retirement schedule (gpt-4o-transcribe 2026-10-15, gpt-4o-mini-transcribe 2025-12-15 → 2027-06-15, whisper 001 → 2026-12-15): https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirement-schedule
- [life]: Foundry model lifecycle policy (preview force-upgrade, 30-day notice): https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirements
- [models]: Foundry Models sold by Azure (audio models table, gpt-transcribe offline): https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure
- [reg]: Region availability for Foundry Models: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability
- [lang]: Azure Speech language support (`ur-IN` only; custom speech: labeled audio only; fast transcription and LLM Speech support): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt
- [lid]: Azure Speech language identification ("Continuous LID doesn't support changing languages within the same sentence", up to 10 candidates): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification
- Azure phrase list ("for locales where the feature is enabled"; not with batch): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list
- [llm]: Azure LLM Speech: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/llm-speech
- [mai]: MAI-Transcribe in Azure Speech (Urdu for MAI-Transcribe-2, code-switching, phrase list, verbatim): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe
- [mai2card]: MAI-Transcribe-2 model card (2026-09-03; 60 languages incl. Urdu; $0.10/h promo; regions): https://microsoft.ai/pdf/MAI-Transcribe-2-Model-Card.pdf and announcement https://microsoft.ai/news/mai-transcribe-2-is-the-fastest-most-accurate-and-cheapest-speech-recognition-model-in-the-world/
- [azp]: Azure Speech pricing page (prices rendered client-side; promo note "till 12/31/2026"): https://azure.microsoft.com/en-us/pricing/details/speech/
- [arp]: Azure Retail Prices API, queried 2026-11-13 (productName 'Azure Speech', region centralindia/eastus; meters for gpt-transcribe, gpt-4o-*-transcribe, Whisper, MAI-Transcribe-2): https://prices.azure.com/api/retail/prices
- [jt]: JoshTalks "Voice of India" ASR benchmark, Draft V2, Aug 2026 (536 h Indian telephone speech; Urdu 26.2 h; OI-WER): https://elevenlabsreport.ai.joshtalks.com/
- [eld]: ElevenLabs speech-to-text docs (Urdu band, keyterms, multilingual mode): https://elevenlabs.io/docs/overview/capabilities/speech-to-text
- [elv3]: ElevenLabs "Introducing Scribe v3 and v3 Live" (2026-11-10): https://elevenlabs.io/blog/scribe-v3
- [elur]: ElevenLabs Urdu transcription page (vendor comparison table): https://elevenlabs.io/speech-to-text/urdu
- [elp]: ElevenLabs API pricing: https://elevenlabs.io/pricing/api
- [chirp3]: Google Chirp 3 docs: https://docs.cloud.google.com/speech-to-text/v2/docs/chirp_3-model
- [gcpl]: Google Speech-to-Text v2 supported languages (`ur-PK`): https://docs.cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages
- [gcpp]: Google Speech-to-Text pricing (figures from search snippet; page did not render for our fetcher): https://cloud.google.com/speech-to-text/pricing
- [dg]: Deepgram models and languages: https://developers.deepgram.com/docs/models-languages-overview
- [dgp]: Deepgram pricing: https://deepgram.com/pricing
- [aai]: AssemblyAI supported languages: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages
- [aaip]: AssemblyAI pricing: https://www.assemblyai.com/pricing
- [hfv3]: https://huggingface.co/kingabzpro/whisper-large-v3-urdu
- [hft]: https://huggingface.co/kingabzpro/whisper-large-v3-turbo-urdu
- LoRA on turbo, CV v23 37.23 → 25.78 WER: https://huggingface.co/awaaz-se-alfaaz/whisper-turbo-v3-urdu
- **[anecdotal]** Our own self-test: Azure Speech `ur-IN` transcribed "فلیٹ" (flat) as "فلگ" (reported by the team, Nov 2026).

[wp]: https://arxiv.org/abs/2212.04356
[turbo]: https://github.com/openai/whisper/discussions/2363
[w1662]: https://github.com/openai/whisper/discussions/1662
[w2761]: https://github.com/openai/whisper/discussions/2761
[wws]: https://arxiv.org/html/2409.11252v1
[dep]: https://developers.openai.com/docs/deprecations
[oaip]: https://developers.openai.com/api/docs/pricing
[gptt]: https://developers.openai.com/api/docs/models/gpt-transcribe
[stt]: https://developers.openai.com/api/docs/guides/speech-to-text
[oaiupd]: https://developers.openai.com/blog/updates-audio-models
[ret]: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirement-schedule
[life]: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirements
[models]: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure
[reg]: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability
[lang]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt
[lid]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification
[llm]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/llm-speech
[mai]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe
[mai2card]: https://microsoft.ai/pdf/MAI-Transcribe-2-Model-Card.pdf
[azp]: https://azure.microsoft.com/en-us/pricing/details/speech/
[arp]: https://prices.azure.com/api/retail/prices
[jt]: https://elevenlabsreport.ai.joshtalks.com/
[eld]: https://elevenlabs.io/docs/overview/capabilities/speech-to-text
[elv3]: https://elevenlabs.io/blog/scribe-v3
[elur]: https://elevenlabs.io/speech-to-text/urdu
[elp]: https://elevenlabs.io/pricing/api
[chirp3]: https://docs.cloud.google.com/speech-to-text/v2/docs/chirp_3-model
[gcpl]: https://docs.cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages
[gcpp]: https://cloud.google.com/speech-to-text/pricing
[dg]: https://developers.deepgram.com/docs/models-languages-overview
[dgp]: https://deepgram.com/pricing
[aai]: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages
[aaip]: https://www.assemblyai.com/pricing
[hfv3]: https://huggingface.co/kingabzpro/whisper-large-v3-urdu
[hft]: https://huggingface.co/kingabzpro/whisper-large-v3-turbo-urdu
