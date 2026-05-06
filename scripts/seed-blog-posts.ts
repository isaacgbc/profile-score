/**
 * Phase 5.1 Step 3: Seed 6 new bilingual blog posts
 *
 * Content format: HTML (rendered via dangerouslySetInnerHTML in BlogArticle).
 * Each post: bilingual EN + ES, genuine advice, internal links, 1200-2000 words.
 * BlogArticle component auto-appends CTA — no CTA needed in content HTML.
 *
 * Usage: npx tsx scripts/seed-blog-posts.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// POST 1: How to Improve Your LinkedIn Profile in 2026
// Target: "how to improve LinkedIn profile", "cómo mejorar perfil LinkedIn"
// ─────────────────────────────────────────────────────────────

const post1En = `
<p><em>Last updated: March 2026</em></p>

<p>Your LinkedIn profile is your digital first impression. In 2026, over 95% of recruiters use LinkedIn to find candidates — and they spend less than 10 seconds deciding whether to click on your profile. If your profile isn't compelling, optimized, and keyword-rich, you're invisible.</p>

<p>This guide walks you through every section of your LinkedIn profile with specific, actionable steps you can implement today.</p>

<h2>1. Why LinkedIn Profile Optimization Actually Matters</h2>
<p>LinkedIn's algorithm decides who appears in recruiter searches based on profile completeness, keyword relevance, and engagement signals. A weak profile doesn't just fail to attract opportunities — it actively ranks lower in search results.</p>

<p>The good news: most professionals have the same generic profile. Standing out requires only moderate effort applied strategically. Knowing where to focus is the challenge — which is exactly what <a href="/features">ProfileScore's AI audit</a> is designed to solve.</p>

<h2>2. Your Profile Photo: The First Click Decision</h2>
<p>Profiles with professional photos get <strong>21× more profile views</strong> and <strong>36× more messages</strong>. The photo is the thumbnail that determines whether someone clicks on you at all.</p>

<ul>
<li><strong>Use a recent, high-quality photo</strong> — no selfies, cropped group photos, or photos older than 5 years.</li>
<li><strong>Face fills 60-70% of the frame.</strong> Center your face, smile naturally.</li>
<li><strong>Plain or blurred background.</strong> Avoid busy backgrounds that compete with your face.</li>
<li><strong>Professional attire.</strong> Dress for the role you want, not the one you have.</li>
<li><strong>Add a background banner.</strong> This prime real estate (1584×396px) is ignored by 80% of users. Use it to reinforce your professional brand with a relevant image or tagline.</li>
</ul>

<h2>3. Your Headline: 220 Characters to Hook a Recruiter</h2>
<p>The default LinkedIn headline is your job title at your current company. That's a waste. Your headline appears in search results, connection requests, and comments — it's your most-seen text on the platform.</p>

<p>The most effective headline formula: <strong>[Role] | [Value Proposition] | [Industry/Specialty]</strong></p>

<p>Examples that work:</p>
<ul>
<li>Senior Software Engineer | Building scalable APIs at fintech startups | Python, AWS, distributed systems</li>
<li>Marketing Manager | Helping B2B SaaS companies grow MRR with content-led SEO | 5× organic growth in 2 years</li>
<li>Recent CS Graduate | Full-stack developer specializing in React + Node.js | Open to remote roles</li>
</ul>

<p>Notice what these have in common: they describe <em>what you do</em>, <em>for whom</em>, and <em>what result you create</em>. Generic titles like "Marketing Professional" tell recruiters nothing.</p>

<h2>4. The About Section: Your Professional Story</h2>
<p>The About section (formerly "Summary") is where you convert a profile view into a message. Most people either leave it blank or paste their resume summary — both are missed opportunities.</p>

<p>Structure your About section in four parts:</p>

<ol>
<li><strong>Hook (first two lines):</strong> LinkedIn shows only the first 200 characters before "see more." Your opening must compel the click. Lead with a specific achievement or a provocative professional statement — not "I am a passionate professional."</li>
<li><strong>Your story:</strong> Connect the dots of your career. Why did you make the choices you made? What drives you professionally? Write in first person, conversational but professional tone.</li>
<li><strong>Proof:</strong> Include 2-3 quantified achievements. "Grew ARR from $2M to $8M in 18 months" is infinitely more compelling than "delivered strong revenue growth."</li>
<li><strong>Call to action:</strong> End with how to reach you or what you're looking for. "Open to senior product roles at growth-stage startups — DM me."</li>
</ol>

<p>Aim for 3-5 short paragraphs. Avoid walls of text — LinkedIn's mobile app renders long blocks poorly.</p>

<h2>5. Work Experience: From Duties to Achievements</h2>
<p>This is where most profiles fail. A list of responsibilities tells recruiters what your job description said — not what you actually accomplished. Recruiters and hiring managers want to see <strong>impact</strong>.</p>

<p>Transform every bullet using the <strong>XYZ Formula</strong>:</p>
<blockquote>
<p>"Accomplished [X] as measured by [Y] by doing [Z]"</p>
</blockquote>

<p>Before: "Responsible for managing social media accounts and creating content."<br>
After: "Grew LinkedIn following from 2,400 to 18,000 in 8 months by launching a daily insights series, driving a 340% increase in inbound leads."</p>

<p>Rules for experience bullets:</p>
<ul>
<li>Start every bullet with a strong action verb: Led, Built, Grew, Reduced, Launched, Streamlined.</li>
<li>Include at least one metric per role — revenue, percentage growth, team size, time saved, users served.</li>
<li>Current role: 4-6 bullets. Previous roles: 2-4 bullets. Roles 5+ years ago: 1-2 bullets max.</li>
<li>Never use: "Responsible for," "Helped with," "Assisted in," "Participated in."</li>
</ul>

<p>Use ProfileScore's <a href="/features">AI rewrite feature</a> to automatically transform your existing bullets into impact statements — it identifies which bullets lack metrics and rewrites them using the XYZ formula.</p>

<h2>6. Skills: Your Keyword Engine</h2>
<p>LinkedIn's search algorithm uses your skills section as a primary keyword signal. The skills you list determine whether you appear when a recruiter searches for "Python developer" or "UX researcher."</p>

<p>Best practices:</p>
<ul>
<li><strong>Add all 50 allowed skills.</strong> Most people add 10-15. Fill every slot.</li>
<li><strong>Order strategically.</strong> LinkedIn shows your top 3 skills prominently — put your most valuable and most searched skills first.</li>
<li><strong>Match the job description language exactly.</strong> If job postings say "product analytics" rather than "data analysis," use that exact phrase.</li>
<li><strong>Seek endorsements for your top skills.</strong> Skills with 5+ endorsements appear more credible to recruiters.</li>
</ul>

<h2>7. Education: More Than Just Your Degree</h2>
<p>For recent graduates (last 3 years), the education section is a key differentiator. Include:</p>
<ul>
<li>Relevant coursework (list 4-6 courses relevant to your target role)</li>
<li>Academic honors (Dean's List, scholarships, awards)</li>
<li>Thesis, capstone projects, or significant research</li>
<li>GPA if above 3.5 and within 5 years of graduation</li>
<li>Clubs and societies that show leadership or relevant skills</li>
</ul>

<p>For professionals with 5+ years of experience, keep education concise. Recruiters are focused on your work history.</p>

<h2>8. Recommendations: Social Proof That Converts</h2>
<p>LinkedIn recommendations are the professional equivalent of reference letters — visible to anyone who views your profile. Having 3-5 quality recommendations makes your profile dramatically more credible.</p>

<p>Request recommendations from: former managers, direct reports who can speak to your leadership, cross-functional colleagues, and clients or partners. Give them specific guidance on what you'd like them to highlight — this makes it easier for them to write and ensures the recommendation supports your narrative.</p>

<h2>9. Measure Your Profile Score</h2>
<p>The fastest way to identify exactly which sections need improvement — and in what priority order — is to get an objective audit. <a href="/features">ProfileScore analyzes your LinkedIn profile section by section</a>, scores each area on a 0-100 scale, and provides specific rewrite recommendations for your lowest-scoring sections.</p>

<p>Most users improve their overall score by 20-35 points after implementing the top 3 recommendations. <a href="/pricing">Free to start</a> — see your score in under 2 minutes.</p>

<h2>Summary: Your LinkedIn Optimization Checklist</h2>
<ul>
<li>☐ Professional photo (face 60-70% of frame, plain background)</li>
<li>☐ Custom background banner (1584×396px)</li>
<li>☐ Headline: Role | Value Proposition | Specialty (not just job title)</li>
<li>☐ About section: Hook → Story → Proof → CTA</li>
<li>☐ Experience: XYZ formula bullets with metrics</li>
<li>☐ 50 skills filled, ordered by search priority</li>
<li>☐ Education: coursework + honors if recent grad</li>
<li>☐ 3-5 recommendations from credible contacts</li>
<li>☐ Custom LinkedIn URL (linkedin.com/in/yourname)</li>
<li>☐ Profile set to "Open to Work" or "Hiring" if applicable</li>
</ul>
`;

const post1Es = `
<p><em>Última actualización: marzo de 2026</em></p>

<p>Tu perfil de LinkedIn es tu primera impresión digital. En 2026, más del 95% de los reclutadores usan LinkedIn para encontrar candidatos — y dedican menos de 10 segundos a decidir si hacen clic en tu perfil. Si tu perfil no es convincente, optimizado y rico en palabras clave, eres invisible.</p>

<p>Esta guía te lleva por cada sección de tu perfil de LinkedIn con pasos específicos y accionables que puedes implementar hoy mismo.</p>

<h2>1. Por qué optimizar tu perfil de LinkedIn realmente importa</h2>
<p>El algoritmo de LinkedIn decide quién aparece en las búsquedas de reclutadores basándose en la completitud del perfil, relevancia de palabras clave y señales de engagement. Un perfil débil no solo falla en atraer oportunidades — activamente ocupa posiciones más bajas en los resultados de búsqueda.</p>

<p>La buena noticia: la mayoría de los profesionales tienen el mismo perfil genérico. Destacar requiere solo un esfuerzo moderado aplicado estratégicamente. Saber dónde enfocarse es el desafío — que es exactamente para lo que está diseñada la <a href="/features">auditoría de IA de ProfileScore</a>.</p>

<h2>2. Tu foto de perfil: la decisión del primer clic</h2>
<p>Los perfiles con fotos profesionales obtienen <strong>21× más visitas</strong> y <strong>36× más mensajes</strong>. La foto es la miniatura que determina si alguien hace clic en ti.</p>

<ul>
<li><strong>Foto reciente y de alta calidad</strong> — sin selfies, fotos grupales recortadas ni fotos de más de 5 años.</li>
<li><strong>Tu cara debe ocupar el 60-70% del encuadre.</strong> Centra tu cara, sonríe naturalmente.</li>
<li><strong>Fondo liso o difuminado.</strong> Evita fondos muy cargados que compitan con tu cara.</li>
<li><strong>Vestimenta profesional.</strong> Vestite para el rol que querés, no el que tenés.</li>
<li><strong>Agregá una imagen de portada.</strong> Este espacio de primera línea (1584×396px) es ignorado por el 80% de los usuarios. Usalo para reforzar tu marca profesional con una imagen relevante o un eslogan.</li>
</ul>

<h2>3. Tu titular: 220 caracteres para captar a un reclutador</h2>
<p>El titular predeterminado de LinkedIn es tu puesto de trabajo en tu empresa actual. Eso es un desperdicio. Tu titular aparece en resultados de búsqueda, solicitudes de conexión y comentarios — es el texto que más se ve de vos en la plataforma.</p>

<p>La fórmula de titular más efectiva: <strong>[Rol] | [Propuesta de Valor] | [Industria/Especialidad]</strong></p>

<p>Ejemplos que funcionan:</p>
<ul>
<li>Ingeniero de Software Senior | Construyendo APIs escalables en startups fintech | Python, AWS, sistemas distribuidos</li>
<li>Gerente de Marketing | Ayudando a empresas B2B SaaS a crecer su MRR con SEO basado en contenido | Crecimiento orgánico 5× en 2 años</li>
<li>Graduado Reciente en Informática | Desarrollador full-stack especializado en React + Node.js | Disponible para roles remotos</li>
</ul>

<p>Notá lo que tienen en común: describen <em>qué hacés</em>, <em>para quién</em> y <em>qué resultado generás</em>. Títulos genéricos como "Profesional de Marketing" no le dicen nada a los reclutadores.</p>

<h2>4. La sección Acerca de: tu historia profesional</h2>
<p>La sección Acerca de (antes "Resumen") es donde convertís una visita al perfil en un mensaje. La mayoría de las personas la dejan en blanco o pegan el resumen de su CV — ambas son oportunidades perdidas.</p>

<p>Estructurá tu sección Acerca de en cuatro partes:</p>

<ol>
<li><strong>Gancho (primeras dos líneas):</strong> LinkedIn solo muestra los primeros 200 caracteres antes de "ver más." Tu apertura debe generar el clic. Comenzá con un logro específico o una declaración profesional llamativa — no con "Soy un profesional apasionado."</li>
<li><strong>Tu historia:</strong> Conectá los puntos de tu carrera. ¿Por qué tomaste las decisiones que tomaste? ¿Qué te mueve profesionalmente? Escribí en primera persona, tono conversacional pero profesional.</li>
<li><strong>Prueba:</strong> Incluí 2-3 logros cuantificados. "Crecí los ingresos de USD 2M a USD 8M en 18 meses" es infinitamente más convincente que "generé un fuerte crecimiento de ingresos."</li>
<li><strong>Llamada a la acción:</strong> Terminá con cómo contactarte o qué buscás. "Disponible para roles senior de producto en startups en crecimiento — escribime un mensaje."</li>
</ol>

<p>Apuntá a 3-5 párrafos cortos. Evitá bloques de texto largos — la app móvil de LinkedIn los renderiza mal.</p>

<h2>5. Experiencia laboral: de responsabilidades a logros</h2>
<p>Acá es donde la mayoría de los perfiles fallan. Una lista de responsabilidades les dice a los reclutadores lo que decía tu descripción de trabajo — no lo que realmente lograste. Los reclutadores y gerentes de contratación quieren ver <strong>impacto</strong>.</p>

<p>Transformá cada punto usando la <strong>Fórmula XYZ</strong>:</p>
<blockquote>
<p>"Logré [X] medido por [Y] haciendo [Z]"</p>
</blockquote>

<p>Antes: "Responsable de gestionar cuentas de redes sociales y crear contenido."<br>
Después: "Crecí los seguidores de LinkedIn de 2.400 a 18.000 en 8 meses lanzando una serie de insights diarios, generando un aumento del 340% en leads entrantes."</p>

<p>Reglas para los puntos de experiencia:</p>
<ul>
<li>Comenzá cada punto con un verbo de acción fuerte: Lideré, Construí, Crecí, Reduje, Lancé, Optimicé.</li>
<li>Incluí al menos una métrica por rol — ingresos, porcentaje de crecimiento, tamaño del equipo, tiempo ahorrado, usuarios atendidos.</li>
<li>Rol actual: 4-6 puntos. Roles anteriores: 2-4 puntos. Roles de hace 5+ años: 1-2 puntos máximo.</li>
<li>Nunca uses: "Responsable de," "Ayudé con," "Asistí en," "Participé en."</li>
</ul>

<p>Usá la <a href="/features">función de reescritura de IA de ProfileScore</a> para transformar automáticamente tus puntos existentes en declaraciones de impacto.</p>

<h2>6. Habilidades: tu motor de palabras clave</h2>
<p>El algoritmo de búsqueda de LinkedIn usa tu sección de habilidades como señal principal de palabras clave. Las habilidades que listás determinan si aparecés cuando un reclutador busca "desarrollador Python" o "investigador UX."</p>

<ul>
<li><strong>Agregá las 50 habilidades permitidas.</strong> La mayoría de las personas agrega 10-15. Llenás todos los espacios.</li>
<li><strong>Ordenalas estratégicamente.</strong> LinkedIn muestra prominentemente tus 3 habilidades principales — poné primero las más valiosas y buscadas.</li>
<li><strong>Usá el lenguaje exacto de las descripciones de trabajo.</strong> Si los posteos dicen "analítica de producto" en lugar de "análisis de datos," usá esa frase exacta.</li>
<li><strong>Buscá avales para tus habilidades principales.</strong> Las habilidades con 5+ avales aparecen más creíbles para los reclutadores.</li>
</ul>

<h2>7. Medí tu puntaje de perfil</h2>
<p>La forma más rápida de identificar exactamente qué secciones necesitan mejora — y en qué orden de prioridad — es obtener una auditoría objetiva. <a href="/features">ProfileScore analiza tu perfil de LinkedIn sección por sección</a>, puntúa cada área en una escala de 0-100 y proporciona recomendaciones específicas de reescritura para tus secciones con menor puntuación.</p>

<p>La mayoría de los usuarios mejoran su puntaje general en 20-35 puntos después de implementar las 3 principales recomendaciones. <a href="/pricing">Gratis para comenzar</a> — ve tu puntaje en menos de 2 minutos.</p>

<h2>Resumen: tu checklist de optimización de LinkedIn</h2>
<ul>
<li>☐ Foto profesional (cara 60-70% del encuadre, fondo liso)</li>
<li>☐ Imagen de portada personalizada (1584×396px)</li>
<li>☐ Titular: Rol | Propuesta de Valor | Especialidad (no solo título de trabajo)</li>
<li>☐ Sección Acerca de: Gancho → Historia → Prueba → CTA</li>
<li>☐ Experiencia: puntos con fórmula XYZ y métricas</li>
<li>☐ 50 habilidades completas, ordenadas por prioridad de búsqueda</li>
<li>☐ Educación: cursos + honores si sos recién graduado</li>
<li>☐ 3-5 recomendaciones de contactos creíbles</li>
<li>☐ URL personalizada de LinkedIn (linkedin.com/in/tunombre)</li>
<li>☐ Perfil configurado como "Abierto a trabajar" o "Contratando" si aplica</li>
</ul>
`;

// ─────────────────────────────────────────────────────────────
// POST 2: LinkedIn Headline Examples: 15 Formulas
// Target: "LinkedIn headline examples", "mejorar headline LinkedIn"
// ─────────────────────────────────────────────────────────────

const post2En = `
<p><em>Last updated: March 2026</em></p>

<p>Your LinkedIn headline is the most-read text on your entire profile. It appears in search results, under your name in connection requests, next to your comments, and in recruiter InMail previews. Yet most professionals leave it as their job title — a massive missed opportunity.</p>

<p>Below are 15 battle-tested headline formulas with real before/after examples, organized by profession. Copy the formula, adapt to your situation, and watch your profile views climb.</p>

<h2>Why Your Headline Determines Your Visibility</h2>
<p>LinkedIn's search algorithm treats your headline as a high-weight keyword field. A recruiter searching for "product manager consumer apps" will find profiles where those words appear in the headline <em>first</em> — before profiles where those words only appear in experience descriptions.</p>

<p>The 220-character limit is generous. Use it. <a href="/features">ProfileScore's headline score</a> measures your headline against recruiter search patterns and content quality — it's the single section where a quick rewrite yields the fastest score improvement.</p>

<h2>The 5 Core Headline Formulas</h2>

<h3>Formula 1: Role + Value Proposition</h3>
<p><strong>Pattern:</strong> [Job Title] | [What you uniquely deliver]</p>
<p><strong>Best for:</strong> Senior professionals, specialists</p>
<blockquote>
<p>❌ Before: "Senior Product Manager at Acme Corp"<br>
✅ After: "Senior Product Manager | Turning complex user problems into products people love | B2C SaaS, 0→1 products"</p>
</blockquote>

<h3>Formula 2: Results-First</h3>
<p><strong>Pattern:</strong> [Quantified achievement] | [Your Role] | [Specialty]</p>
<p><strong>Best for:</strong> Sales, marketing, growth professionals</p>
<blockquote>
<p>❌ Before: "Marketing Manager | Growth"<br>
✅ After: "Grew organic traffic 8× in 12 months | Head of Content Marketing | B2B SaaS &amp; fintech"</p>
</blockquote>

<h3>Formula 3: Open to Work (Without the Badge)</h3>
<p><strong>Pattern:</strong> [Target Role] | [Top skill] | Open to [type of role]</p>
<p><strong>Best for:</strong> Active job seekers who want subtlety</p>
<blockquote>
<p>❌ Before: "Looking for new opportunities"<br>
✅ After: "Software Engineer | Python, Django, AWS | Open to backend engineering roles at climate or health tech startups"</p>
</blockquote>

<h3>Formula 4: The Specialist Signal</h3>
<p><strong>Pattern:</strong> [Narrow specialty] + [Industry context] + [Credibility marker]</p>
<p><strong>Best for:</strong> Consultants, freelancers, niche experts</p>
<blockquote>
<p>❌ Before: "UX Designer"<br>
✅ After: "UX Designer specializing in B2B enterprise dashboards | Reduced support tickets 40% at 3 SaaS companies | Available for contract work"</p>
</blockquote>

<h3>Formula 5: The Career Changer</h3>
<p><strong>Pattern:</strong> [Previous field] → [Target field] | [Transferable strength]</p>
<p><strong>Best for:</strong> Career changers, people upskilling</p>
<blockquote>
<p>❌ Before: "Former Teacher | Now in Tech"<br>
✅ After: "Educator → Instructional Designer | Transforming complex technical content into learner-centered courses | EdTech &amp; L&amp;D"</p>
</blockquote>

<h2>Headlines by Profession: 10 More Examples</h2>

<h3>Software Engineering</h3>
<ul>
<li><strong>Backend:</strong> "Backend Engineer | Building high-availability APIs that scale to 10M+ requests/day | Go, PostgreSQL, Kubernetes"</li>
<li><strong>Frontend:</strong> "Frontend Engineer | Crafting accessible, pixel-perfect React interfaces | Design system architect | Open to remote"</li>
<li><strong>Full-stack:</strong> "Full-Stack Developer | Rails + React | Shipped 12 products in 5 years — from MVP to acquisition | Startup-focused"</li>
</ul>

<h3>Marketing</h3>
<ul>
<li><strong>SEO:</strong> "SEO Lead | Ranked 200+ pages on page 1 for competitive keywords | B2B SaaS growth specialist"</li>
<li><strong>Paid:</strong> "Performance Marketing Manager | Scaled Meta + Google Ads to $2M/month at 3.8× ROAS | E-commerce &amp; DTC brands"</li>
</ul>

<h3>Design</h3>
<ul>
<li><strong>Product:</strong> "Product Designer | Translating complex workflows into intuitive UIs | NPS +32 across 4 product launches"</li>
<li><strong>Brand:</strong> "Brand Designer | Helped 30+ startups go from idea to visual identity | Specializing in tech &amp; fintech brands"</li>
</ul>

<h3>Data &amp; Analytics</h3>
<ul>
<li>"Data Scientist | Predictive modeling for retail demand forecasting | Reduced inventory costs 18% at Fortune 500 | Python, SQL, dbt"</li>
</ul>

<h3>Finance</h3>
<ul>
<li>"FP&amp;A Manager | Building financial models that actually drive decisions | SaaS metrics specialist | Series A to Series C"</li>
</ul>

<h3>HR &amp; People</h3>
<ul>
<li>"Talent Acquisition Lead | Scaled engineering teams 0→120 in 18 months | Technical recruiting specialist | Remote-first companies"</li>
</ul>

<h2>What NOT to Put in Your Headline</h2>
<p>These are the most common headline mistakes, seen in millions of profiles:</p>
<ul>
<li><strong>"Passionate about [anything]"</strong> — Everyone claims passion. It signals nothing.</li>
<li><strong>"Helping companies achieve their goals"</strong> — Too vague to mean anything.</li>
<li><strong>"Seeking new opportunities"</strong> — Signals need, not value. Replace with what you offer.</li>
<li><strong>"Guru," "Ninja," "Rockstar"</strong> — Recruiters don't search for ninjas.</li>
<li><strong>Your company name only</strong> — Companies rank, people don't. Make it about what you do.</li>
<li><strong>Emojis as the primary structure</strong> — One or two can work; leading with a chain of emojis looks unprofessional in most industries.</li>
</ul>

<h2>How to Test Your Headline</h2>
<p>Read your headline aloud and ask: "If I heard this about a stranger, would I want to talk to them?" If the answer is "maybe" or "no," rewrite it.</p>

<p>Then check: Does it include the keywords a recruiter would search for your target role? If not, you're keyword-invisible in search.</p>

<p><a href="/features">ProfileScore scores your LinkedIn headline</a> specifically — measuring keyword presence, value proposition clarity, length optimization, and differentiation from generic patterns. If your headline score is below 70, a 10-minute rewrite using the formulas above will lift your overall profile score significantly.</p>

<h2>Headline Testing Strategy</h2>
<p>Change your headline, then monitor profile views for 2 weeks (visible in LinkedIn Analytics). A strong headline should increase weekly profile views by 30-50% compared to a generic job title headline. Keep iterating until you find what resonates for your target audience.</p>
`;

const post2Es = `
<p><em>Última actualización: marzo de 2026</em></p>

<p>Tu titular de LinkedIn es el texto más leído de todo tu perfil. Aparece en resultados de búsqueda, bajo tu nombre en solicitudes de conexión, junto a tus comentarios y en previsualizaciones de InMail de reclutadores. Sin embargo, la mayoría de los profesionales lo dejan como su título de trabajo — una oportunidad enorme desperdiciada.</p>

<p>A continuación encontrarás 15 fórmulas de titulares probadas con ejemplos reales de antes y después, organizadas por profesión.</p>

<h2>Por qué tu titular determina tu visibilidad</h2>
<p>El algoritmo de búsqueda de LinkedIn trata tu titular como un campo de palabras clave de alto peso. Un reclutador que busque "gerente de producto apps de consumo" encontrará primero los perfiles donde esas palabras aparecen en el titular — antes que los perfiles donde esas palabras solo aparecen en las descripciones de experiencia.</p>

<p>El límite de 220 caracteres es generoso. Usalo. <a href="/features">La puntuación del titular de ProfileScore</a> mide tu titular contra patrones de búsqueda de reclutadores y calidad de contenido.</p>

<h2>Las 5 fórmulas principales de titular</h2>

<h3>Fórmula 1: Rol + Propuesta de valor</h3>
<p><strong>Patrón:</strong> [Título de trabajo] | [Lo que entregás de forma única]</p>
<p><strong>Ideal para:</strong> Profesionales senior, especialistas</p>
<blockquote>
<p>❌ Antes: "Gerente de Producto Senior en Acme Corp"<br>
✅ Después: "Gerente de Producto Senior | Convierto problemas complejos de usuarios en productos que la gente ama | SaaS B2C, productos 0→1"</p>
</blockquote>

<h3>Fórmula 2: Resultados primero</h3>
<p><strong>Patrón:</strong> [Logro cuantificado] | [Tu Rol] | [Especialidad]</p>
<p><strong>Ideal para:</strong> Profesionales de ventas, marketing, crecimiento</p>
<blockquote>
<p>❌ Antes: "Gerente de Marketing | Crecimiento"<br>
✅ Después: "Crecí el tráfico orgánico 8× en 12 meses | Head of Content Marketing | SaaS B2B y fintech"</p>
</blockquote>

<h3>Fórmula 3: Búsqueda activa (sin el badge)</h3>
<p><strong>Patrón:</strong> [Rol objetivo] | [Habilidad principal] | Disponible para [tipo de rol]</p>
<p><strong>Ideal para:</strong> Buscadores activos de empleo que quieren sutileza</p>
<blockquote>
<p>❌ Antes: "Buscando nuevas oportunidades"<br>
✅ Después: "Ingeniero de Software | Python, Django, AWS | Disponible para roles de backend en startups de clima o salud"</p>
</blockquote>

<h3>Fórmula 4: La señal de especialista</h3>
<p><strong>Patrón:</strong> [Especialidad estrecha] + [Contexto de industria] + [Marcador de credibilidad]</p>
<p><strong>Ideal para:</strong> Consultores, freelancers, expertos de nicho</p>
<blockquote>
<p>❌ Antes: "Diseñador UX"<br>
✅ Después: "Diseñador UX especializado en dashboards empresariales B2B | Reduje tickets de soporte 40% en 3 empresas SaaS | Disponible para trabajo por contrato"</p>
</blockquote>

<h3>Fórmula 5: El cambio de carrera</h3>
<p><strong>Patrón:</strong> [Campo anterior] → [Campo objetivo] | [Fortaleza transferible]</p>
<p><strong>Ideal para:</strong> Personas en transición de carrera</p>
<blockquote>
<p>❌ Antes: "Ex Docente | Ahora en Tech"<br>
✅ Después: "Docente → Diseñador Instruccional | Transformo contenido técnico complejo en cursos centrados en el aprendiz | EdTech y L&amp;D"</p>
</blockquote>

<h2>Titulares por profesión: 10 ejemplos más</h2>

<h3>Ingeniería de Software</h3>
<ul>
<li><strong>Backend:</strong> "Ingeniero Backend | APIs de alta disponibilidad que escalan a 10M+ solicitudes/día | Go, PostgreSQL, Kubernetes"</li>
<li><strong>Frontend:</strong> "Ingeniero Frontend | Interfaces React accesibles y pixel-perfect | Arquitecto de design systems | Disponible remoto"</li>
</ul>

<h3>Marketing</h3>
<ul>
<li><strong>SEO:</strong> "Líder SEO | 200+ páginas en la primera posición para palabras clave competitivas | Especialista en crecimiento SaaS B2B"</li>
<li><strong>Paid:</strong> "Gerente de Marketing de Performance | Escalé Meta + Google Ads a USD 2M/mes con ROAS 3.8× | Marcas e-commerce y DTC"</li>
</ul>

<h3>Diseño</h3>
<ul>
<li><strong>Producto:</strong> "Diseñadora de Producto | Convirtiendo flujos de trabajo complejos en UIs intuitivas | NPS +32 en 4 lanzamientos de producto"</li>
</ul>

<h3>Datos y Análisis</h3>
<ul>
<li>"Científica de Datos | Modelos predictivos para previsión de demanda retail | Reduje costos de inventario 18% en Fortune 500 | Python, SQL, dbt"</li>
</ul>

<h2>Lo que NO poner en tu titular</h2>
<ul>
<li><strong>"Apasionado/a por [cualquier cosa]"</strong> — Todo el mundo dice que es apasionado. No significa nada.</li>
<li><strong>"Ayudando a las empresas a alcanzar sus objetivos"</strong> — Demasiado vago para significar algo.</li>
<li><strong>"Buscando nuevas oportunidades"</strong> — Señala necesidad, no valor. Reemplazalo con lo que ofrecés.</li>
<li><strong>"Guru," "Ninja," "Rockstar"</strong> — Los reclutadores no buscan ninjas.</li>
<li><strong>Solo el nombre de tu empresa</strong> — Las empresas rankean, las personas no. Enfocate en lo que hacés.</li>
</ul>

<h2>Cómo testar tu titular</h2>
<p>Leé tu titular en voz alta y preguntate: "Si escuchara esto sobre un desconocido, ¿querría hablar con esa persona?" Si la respuesta es "tal vez" o "no", reescribilo.</p>

<p><a href="/features">ProfileScore puntúa tu titular de LinkedIn</a> específicamente — midiendo presencia de palabras clave, claridad de propuesta de valor, optimización de longitud y diferenciación de patrones genéricos. Si tu puntuación de titular está por debajo de 70, una reescritura de 10 minutos usando las fórmulas anteriores elevará significativamente tu puntuación general de perfil.</p>
`;

// ─────────────────────────────────────────────────────────────
// POST 3: ATS-Friendly Resume: The Complete 2026 Guide
// Target: "CV ATS friendly", "ATS resume format"
// ─────────────────────────────────────────────────────────────

const post3En = `
<p><em>Last updated: March 2026</em></p>

<p>You spent hours crafting your resume. You applied to 50 jobs. You heard back from 2. The problem might not be your qualifications — it might be your resume format. If your resume isn't ATS-friendly, it's being filtered out before a human ever sees it.</p>

<p>This guide covers everything you need to know about ATS in 2026: what it does, how it scores your resume, and the exact formatting rules to make it past automated screening.</p>

<h2>What Is an ATS and Why Does It Matter?</h2>
<p>An Applicant Tracking System (ATS) is software that employers use to collect, filter, and rank job applications. When you apply for a job, your resume is parsed by an ATS before any human sees it. The ATS extracts your information, matches it against the job description, and assigns a relevance score.</p>

<p>Resumes that score above a threshold are passed to recruiters. Resumes below that threshold are automatically rejected — often without the employer ever knowing a potentially qualified candidate applied.</p>

<p>According to industry research, <strong>over 70% of large company job applications</strong> are filtered through ATS. At companies receiving thousands of applications, that number approaches 100%.</p>

<h2>How ATS Parsing Works</h2>
<p>ATS systems parse resumes by:</p>
<ol>
<li><strong>Extracting text</strong> from your document and separating it into fields: name, contact, work experience, education, skills.</li>
<li><strong>Matching keywords</strong> from the job description against your extracted text. Exact and near-exact matches score higher.</li>
<li><strong>Checking structure</strong> for recognizable section headers, date formats, and job title patterns.</li>
<li><strong>Scoring overall relevance</strong> and ranking candidates against each other.</li>
</ol>

<p>The critical implication: <strong>ATS can only read what it can parse.</strong> Anything embedded in images, text boxes, headers/footers, or complex tables may be completely invisible to the system — effectively removing it from your resume.</p>

<h2>ATS Formatting Rules: What to Do</h2>

<h3>File Format</h3>
<ul>
<li><strong>Submit .docx or .pdf.</strong> Most modern ATS handle both. When in doubt, .docx is safer — some older systems struggle with PDFs created by design software.</li>
<li><strong>Avoid .pages, .odt, or image-based PDFs</strong> (scanned documents). These are often unreadable by ATS.</li>
</ul>

<h3>Layout and Structure</h3>
<ul>
<li><strong>Single-column layout only.</strong> Two-column resumes look great to humans but break ATS parsing — content in the second column is often read out of order or skipped entirely.</li>
<li><strong>No tables, text boxes, or columns.</strong> These elements confuse parsers. Use plain paragraphs and bullet lists.</li>
<li><strong>No headers or footers</strong> for critical information. ATS often skip header/footer regions. Your name and contact info must be in the main body.</li>
<li><strong>No graphics, icons, or images.</strong> ATS cannot read text embedded in images. A resume with a chart or skill bar graphic loses all that information.</li>
<li><strong>Standard fonts only.</strong> Times New Roman, Arial, Calibri, or Helvetica. Avoid decorative fonts.</li>
</ul>

<h3>Section Headers</h3>
<p>Use standard, recognizable section names. ATS are trained to find these:</p>
<ul>
<li>Work Experience (not "Where I've Been" or "My Career Journey")</li>
<li>Education (not "Academic Background")</li>
<li>Skills (not "What I Know" or "Competencies")</li>
<li>Summary or Professional Summary (not "About Me")</li>
</ul>
<p>Creative headers fail because ATS doesn't know what category to assign the content under.</p>

<h3>Dates</h3>
<ul>
<li>Use consistent date formats: "Jan 2022 – Mar 2024" or "01/2022 – 03/2024."</li>
<li>Include both start and end month/year for every role. ATS uses dates to calculate tenure and chronological ordering.</li>
<li>For current roles: "Jan 2023 – Present."</li>
</ul>

<h2>The Keyword Strategy That Actually Works</h2>
<p>Keywords are how ATS matches your resume to a job description. The strategy isn't to stuff keywords randomly — it's to mirror the exact language the employer uses.</p>

<p>Step-by-step:</p>
<ol>
<li><strong>Read the job description carefully.</strong> Identify the 10-15 most important skills, tools, and qualifications mentioned.</li>
<li><strong>Check your resume.</strong> Which of those terms appear exactly as stated in the job description?</li>
<li><strong>Add missing terms naturally.</strong> Integrate them into your experience bullets and skills section. Don't force awkward phrasing.</li>
<li><strong>Include both acronyms and full forms.</strong> "SEO (Search Engine Optimization)" — the ATS may search for either version.</li>
<li><strong>Don't stuff.</strong> ATS have evolved to detect keyword stuffing. Using the same keyword 12 times won't help and may flag your resume.</li>
</ol>

<p>Example: If the job description says "cross-functional stakeholder management" and your resume says "worked with different teams," the ATS match score is zero for that requirement. Rewrite to mirror their language.</p>

<h2>The Wonsulting Format: ATS-Tested at Scale</h2>
<p>The most ATS-proven resume format is the Wonsulting format: single-column, Times New Roman, US Letter (8.5"×11"), name at 18pt, all text black, no graphics. Every entry follows:</p>
<ul>
<li>Company Name (bold) → Location (right-aligned)</li>
<li>Job Title (italic) → Date Range (right-aligned, italic)</li>
<li>3-6 achievement bullets</li>
</ul>

<p>This is exactly the format <a href="/features">ProfileScore generates</a> when you export your Updated CV — a clean, ATS-optimized Word document and PDF that passes every parser we've tested.</p>

<h2>ATS Red Flags: What to Avoid</h2>
<ul>
<li>Skill rating bars (the ATS can't read the percentage, only the label)</li>
<li>"References available upon request" (wastes space, adds zero value to ATS score)</li>
<li>Objective statements (replace with a professional summary with keywords)</li>
<li>Photos on your resume (outside of creative industries, photos are inappropriate for most US/LATAM markets)</li>
<li>Fancy bullet characters (filled squares, arrows, etc.) — stick to standard bullets or hyphens</li>
</ul>

<h2>Test Your Resume Against ATS</h2>
<p>Before applying to any job, <a href="/features">run your CV through ProfileScore's AI audit</a>. It checks for ATS compatibility issues, missing keywords, and formatting problems — then generates an ATS-clean version you can download immediately.</p>

<p>The <a href="/pricing">Updated CV export ($5 add-on)</a> produces a DOCX and PDF in the Wonsulting format with all your AI-rewritten content, ready to submit to any ATS.</p>
`;

const post3Es = `
<p><em>Última actualización: marzo de 2026</em></p>

<p>Pasaste horas elaborando tu CV. Aplicaste a 50 trabajos. Recibiste respuesta de 2. El problema puede no ser tus calificaciones — puede ser el formato de tu CV. Si tu CV no es amigable con ATS, está siendo filtrado antes de que un humano lo vea.</p>

<p>Esta guía cubre todo lo que necesitás saber sobre ATS en 2026: qué hace, cómo puntúa tu CV, y las reglas de formato exactas para pasar el filtrado automático.</p>

<h2>¿Qué es un ATS y por qué importa?</h2>
<p>Un Sistema de Seguimiento de Candidatos (ATS) es un software que los empleadores usan para recopilar, filtrar y clasificar solicitudes de empleo. Cuando aplicás a un trabajo, tu CV es analizado por un ATS antes de que cualquier humano lo vea. El ATS extrae tu información, la compara con la descripción del puesto y le asigna una puntuación de relevancia.</p>

<p>Los CVs que superan un umbral se pasan a los reclutadores. Los CVs por debajo de ese umbral son rechazados automáticamente — a menudo sin que el empleador sepa que un candidato potencialmente calificado aplicó.</p>

<p>Según investigaciones de la industria, <strong>más del 70% de las solicitudes de empleo en grandes empresas</strong> son filtradas a través de ATS. En empresas que reciben miles de solicitudes, ese número se acerca al 100%.</p>

<h2>Cómo funciona el análisis ATS</h2>
<p>Los sistemas ATS analizan CVs:</p>
<ol>
<li><strong>Extrayendo texto</strong> de tu documento y separándolo en campos: nombre, contacto, experiencia laboral, educación, habilidades.</li>
<li><strong>Comparando palabras clave</strong> de la descripción del puesto con tu texto extraído. Las coincidencias exactas y aproximadas puntúan más alto.</li>
<li><strong>Verificando la estructura</strong> para encabezados de sección reconocibles, formatos de fecha y patrones de título de trabajo.</li>
<li><strong>Puntuando la relevancia general</strong> y clasificando a los candidatos entre sí.</li>
</ol>

<p>La implicación crítica: <strong>el ATS solo puede leer lo que puede analizar.</strong> Cualquier cosa incrustada en imágenes, cuadros de texto, encabezados/pies de página o tablas complejas puede ser completamente invisible para el sistema.</p>

<h2>Reglas de formato ATS: qué hacer</h2>

<h3>Formato de archivo</h3>
<ul>
<li><strong>Enviá .docx o .pdf.</strong> La mayoría de los ATS modernos manejan ambos. En caso de duda, .docx es más seguro.</li>
<li><strong>Evitá .pages, .odt o PDFs basados en imágenes</strong> (documentos escaneados). Estos suelen ser ilegibles para el ATS.</li>
</ul>

<h3>Diseño y estructura</h3>
<ul>
<li><strong>Solo diseño de una columna.</strong> Los CVs de dos columnas se ven geniales para los humanos pero rompen el análisis del ATS.</li>
<li><strong>Sin tablas, cuadros de texto ni columnas.</strong> Estos elementos confunden a los analizadores. Usá párrafos simples y listas de viñetas.</li>
<li><strong>Sin encabezados ni pies de página</strong> para información crítica. El ATS a menudo omite estas regiones.</li>
<li><strong>Sin gráficos, íconos ni imágenes.</strong> El ATS no puede leer texto incrustado en imágenes.</li>
<li><strong>Solo fuentes estándar.</strong> Times New Roman, Arial, Calibri o Helvetica.</li>
</ul>

<h3>Encabezados de sección</h3>
<p>Usá nombres de sección estándar y reconocibles:</p>
<ul>
<li>Experiencia Laboral (no "Mi Trayectoria" o "Dónde Trabajé")</li>
<li>Educación (no "Formación Académica")</li>
<li>Habilidades (no "Lo Que Sé")</li>
<li>Resumen o Resumen Profesional (no "Sobre Mí")</li>
</ul>

<h2>La estrategia de palabras clave que realmente funciona</h2>
<p>Las palabras clave son cómo el ATS relaciona tu CV con una descripción de trabajo. La estrategia no es rellenar palabras clave al azar — es reflejar el lenguaje exacto que usa el empleador.</p>

<ol>
<li><strong>Leé la descripción del trabajo cuidadosamente.</strong> Identificá las 10-15 habilidades, herramientas y calificaciones más importantes mencionadas.</li>
<li><strong>Verificá tu CV.</strong> ¿Cuáles de esos términos aparecen exactamente como se indican en la descripción del trabajo?</li>
<li><strong>Agregá los términos faltantes de forma natural.</strong> Integralos en tus viñetas de experiencia y sección de habilidades.</li>
<li><strong>Incluí tanto siglas como formas completas.</strong> "SEO (Search Engine Optimization)" — el ATS puede buscar cualquiera de las dos versiones.</li>
</ol>

<h2>El formato Wonsulting: probado con ATS a escala</h2>
<p>El formato de CV más probado con ATS es el formato Wonsulting: una sola columna, Times New Roman, US Letter (8,5"×11"), nombre en 18pt, todo el texto en negro, sin gráficos.</p>

<p>Este es exactamente el formato que <a href="/features">ProfileScore genera</a> cuando exportás tu CV Actualizado — un documento Word limpio y optimizado para ATS que supera todos los analizadores que hemos probado.</p>

<h2>Evaluá tu CV contra ATS</h2>
<p>Antes de aplicar a cualquier trabajo, <a href="/features">pasá tu CV por la auditoría de IA de ProfileScore</a>. Verifica problemas de compatibilidad con ATS, palabras clave faltantes y problemas de formato — luego genera una versión limpia para ATS que podés descargar de inmediato.</p>

<p>La <a href="/pricing">exportación de CV Actualizado</a> produce un DOCX y PDF en el formato Wonsulting con todo tu contenido reescrito por IA, listo para enviar a cualquier ATS.</p>
`;

// ─────────────────────────────────────────────────────────────
// POST 4: LinkedIn About Section: How to Write a Summary
// Target: "LinkedIn about section", "LinkedIn summary examples"
// ─────────────────────────────────────────────────────────────

const post4En = `
<p><em>Last updated: March 2026</em></p>

<p>The LinkedIn About section is the most underused piece of real estate on the entire platform. Most people either leave it empty or paste a stilted third-person bio that reads like it was written about someone else. The result: recruiters skim past it, and a potential connection is lost.</p>

<p>Done well, your About section converts a profile view into a message, a connection request into a conversation, and a conversation into an opportunity. Here's the framework that works.</p>

<h2>The 4-Part About Section Framework</h2>

<h3>Part 1: The Hook (First 2 Lines)</h3>
<p>LinkedIn shows only the first ~200 characters of your About section before collapsing it with a "…see more" link. Your first two lines must make someone want to click through.</p>

<p>What works: a specific achievement, a bold professional stance, or an intriguing question. What doesn't work: "I am a passionate and results-driven professional."</p>

<p>Strong hooks by profession:</p>
<ul>
<li><strong>Engineer:</strong> "I've shipped 12 products. 3 failed spectacularly, and those were the most instructive. Here's what I've learned about building things that actually last."</li>
<li><strong>Marketer:</strong> "In 2024, I grew a newsletter from 0 to 42,000 subscribers without spending a dollar on ads. This is what I did and why it worked."</li>
<li><strong>Finance:</strong> "Most financial models tell you what happened. I build models that tell you what to do next. Here's my approach."</li>
<li><strong>Recent grad:</strong> "I graduated last May with a CS degree and three internships. In that time, I deployed an ML model used by 10,000 daily users. Here's what I'm focused on next."</li>
</ul>

<h3>Part 2: Your Story (2-3 Paragraphs)</h3>
<p>Connect the dots of your career. This isn't a resume summary — it's your professional narrative. Why did you make the moves you made? What do you uniquely understand after years in your field?</p>

<p>Write in first person. Use conversational language — this is not a formal document. You're talking to a person who might become your next client, employer, or collaborator.</p>

<p>What to cover:</p>
<ul>
<li>The thread that connects your experience — what expertise have you built across different roles?</li>
<li>The problems you're most energized to solve</li>
<li>What makes your approach different from others in your field</li>
</ul>

<h3>Part 3: Proof (2-4 Quantified Achievements)</h3>
<p>This is where most About sections fail. Claims without evidence are noise. Evidence without context is dry. The winning combination: a specific result + why it mattered.</p>

<p>Format your proof points as punchy sentences, not resume bullets:</p>
<ul>
<li>"I reduced customer churn by 23% in 6 months by rebuilding our onboarding flow from scratch — saving an estimated $1.8M in ARR."</li>
<li>"Built and led a team of 14 engineers across 3 time zones, shipping a platform that now processes $2B in annual transactions."</li>
<li>"My last product was acquired 18 months after launch. We'd grown to 180,000 users with zero paid acquisition."</li>
</ul>

<h3>Part 4: Call to Action</h3>
<p>End with what you want. Don't leave people guessing. Options:</p>
<ul>
<li>Open to specific roles: "Open to VP Product roles at Series B+ companies in health tech. DM me or connect — I respond to every message."</li>
<li>Client attraction: "I work with 3-5 companies at a time on contract. If you're a SaaS company looking to scale organic growth, let's talk."</li>
<li>General networking: "Always happy to connect with founders, operators, and anyone doing interesting work in [space]. Drop me a note."</li>
</ul>

<h2>About Section Examples by Role</h2>

<h3>Example 1: Product Manager (Mid-Level)</h3>
<blockquote>
<p>Three of the products I've worked on have been acquired. I don't think that's luck — I think it's because I'm obsessive about understanding why users do what they do before writing a single line of product spec.</p>

<p>I've spent the last 6 years building consumer products at the intersection of fintech and social. My career has taken me from 3-person startups to 500-person scale-ups, which means I know how to build products with almost no resources and how to scale them once you have resources but everything is suddenly political.</p>

<p>Currently at Acme, where I lead the payments product team (4 PMs, $40M revenue line). Before that: Startup A (acquired by BigCo, 2023), Startup B (acquired by MegaCorp, 2021).</p>

<p>Exploring new opportunities in consumer fintech or social commerce. Open to Head of Product or VP Product roles. DM me if you're building something interesting.</p>
</blockquote>

<h3>Example 2: Software Engineer (Recent Graduate)</h3>
<blockquote>
<p>Last year I deployed a machine learning model that now helps 10,000 daily users get personalized workout plans — built with a team of two during my final semester.</p>

<p>I graduated in May 2025 from [University] with a CS degree focused on ML and distributed systems. During school, I completed internships at [Company A] (backend infra) and [Company B] (ML engineering), where I learned how production systems actually fail — which is different from how textbooks say they fail.</p>

<p>I write clean code, I care about tests, and I like understanding the business context behind what I'm building. I'm looking for a full-stack or backend engineering role at a company that ships frequently and learns from real users.</p>

<p>Open to roles in SF, NYC, or remote. Let's connect.</p>
</blockquote>

<h3>Example 3: Marketing Manager (Career Changer)</h3>
<blockquote>
<p>Four years ago I was a high school teacher. Today I run growth marketing for a SaaS company with 50,000 users. The transition was intentional, and the teaching background was an advantage — not a liability.</p>

<p>Teaching gave me skills that most marketers lack: how to explain complex concepts clearly, how to hold attention in a distracted environment, and how to measure whether learning actually happened (which is just conversion optimization with different vocabulary).</p>

<p>Since moving into marketing, I've grown an email list from 800 to 28,000 subscribers, launched a content program that generates 40% of inbound pipeline, and rebuilt a company blog from 1,200 to 45,000 monthly organic visitors.</p>

<p>Open to Head of Content or Director of Marketing roles at B2B SaaS companies that believe content is a durable growth channel. Let's talk.</p>
</blockquote>

<h2>Common Mistakes to Avoid</h2>
<ul>
<li><strong>Third-person writing.</strong> "John is a seasoned professional…" — this is your profile, write as yourself.</li>
<li><strong>Buzzword openers.</strong> "Results-driven," "passionate," "dynamic," "seasoned" — these words appear in millions of About sections and convey nothing.</li>
<li><strong>Wall of text.</strong> Break it into short paragraphs. White space is readable. Dense blocks are skipped.</li>
<li><strong>Copy-pasting your resume.</strong> The About section is a narrative, not a list. Write, don't list.</li>
<li><strong>No CTA.</strong> If you don't tell people what to do, they'll do nothing. End with a clear ask.</li>
</ul>

<h2>Get Your About Section Scored</h2>
<p><a href="/features">ProfileScore analyzes your LinkedIn About section</a> and scores it on clarity, keyword presence, proof density, and hook strength. If your About section scores below 65, the AI rewrite tool can suggest specific rewrites — starting with your opening hook, which has the highest impact on conversion.</p>
`;

const post4Es = `
<p><em>Última actualización: marzo de 2026</em></p>

<p>La sección Acerca de de LinkedIn es el espacio más desaprovechado de toda la plataforma. La mayoría de las personas la deja vacía o pega una biografía en tercera persona que parece escrita sobre otra persona. El resultado: los reclutadores la pasan por alto y se pierde una conexión potencial.</p>

<p>Bien hecha, tu sección Acerca de convierte una visita al perfil en un mensaje, una solicitud de conexión en una conversación, y una conversación en una oportunidad.</p>

<h2>El framework de 4 partes para la sección Acerca de</h2>

<h3>Parte 1: El gancho (primeras 2 líneas)</h3>
<p>LinkedIn muestra solo los primeros ~200 caracteres de tu sección Acerca de antes de contraerla con un enlace "…ver más". Tus primeras dos líneas deben hacer que alguien quiera hacer clic.</p>

<p>Lo que funciona: un logro específico, una postura profesional audaz o una pregunta intrigante. Lo que no funciona: "Soy un profesional apasionado y orientado a resultados."</p>

<p>Ganchos fuertes por profesión:</p>
<ul>
<li><strong>Ingeniero/a:</strong> "Lancé 12 productos. 3 fracasaron espectacularmente, y esos fueron los más instructivos. Acá está lo que aprendí sobre construir cosas que realmente duran."</li>
<li><strong>Marketer:</strong> "En 2024, hice crecer una newsletter de 0 a 42.000 suscriptores sin gastar un peso en publicidad. Esto es lo que hice y por qué funcionó."</li>
<li><strong>Recién graduado/a:</strong> "Me gradué el año pasado con un título en Informática y tres pasantías. En ese tiempo, desplegué un modelo de ML usado por 10.000 usuarios diarios. Acá está en qué me estoy enfocando ahora."</li>
</ul>

<h3>Parte 2: Tu historia (2-3 párrafos)</h3>
<p>Conectá los puntos de tu carrera. Esto no es un resumen de CV — es tu narrativa profesional. ¿Por qué tomaste las decisiones que tomaste? ¿Qué entendés de forma única después de años en tu campo?</p>

<p>Escribí en primera persona. Usá lenguaje conversacional — este no es un documento formal. Estás hablando con una persona que puede convertirse en tu próximo cliente, empleador o colaborador.</p>

<h3>Parte 3: Prueba (2-4 logros cuantificados)</h3>
<p>Acá es donde la mayoría de las secciones Acerca de fallan. Las afirmaciones sin evidencia son ruido. La evidencia sin contexto es árida. La combinación ganadora: un resultado específico + por qué importó.</p>

<ul>
<li>"Reduje la pérdida de clientes en un 23% en 6 meses reconstruyendo nuestro flujo de incorporación desde cero — ahorrando un estimado de USD 1,8M en ARR."</li>
<li>"Construí y lideré un equipo de 14 ingenieros en 3 zonas horarias, lanzando una plataforma que ahora procesa USD 2.000M en transacciones anuales."</li>
</ul>

<h3>Parte 4: Llamada a la acción</h3>
<p>Terminá con lo que querés. No dejes que la gente adivine:</p>
<ul>
<li>"Disponible para roles de VP Producto en empresas Serie B+ en salud tech. Escribime un mensaje — respondo a todos."</li>
<li>"Trabajo con 3-5 empresas a la vez por contrato. Si tenés una empresa SaaS que busca escalar el crecimiento orgánico, hablemos."</li>
</ul>

<h2>Errores comunes a evitar</h2>
<ul>
<li><strong>Escritura en tercera persona.</strong> "Juan es un profesional experimentado…" — este es tu perfil, escribí como vos mismo.</li>
<li><strong>Aperturas con buzzwords.</strong> "Orientado a resultados," "apasionado," "dinámico," "experimentado" — estas palabras aparecen en millones de secciones Acerca de y no transmiten nada.</li>
<li><strong>Muro de texto.</strong> Dividilo en párrafos cortos. El espacio en blanco es legible. Los bloques densos se omiten.</li>
<li><strong>Copiar y pegar tu CV.</strong> La sección Acerca de es una narrativa, no una lista.</li>
<li><strong>Sin CTA.</strong> Si no les decís a las personas qué hacer, no harán nada.</li>
</ul>

<h2>Obtené la puntuación de tu sección Acerca de</h2>
<p><a href="/features">ProfileScore analiza tu sección Acerca de de LinkedIn</a> y la puntúa en claridad, presencia de palabras clave, densidad de prueba y fuerza del gancho. Si tu sección Acerca de puntúa por debajo de 65, la herramienta de reescritura de IA puede sugerir reescrituras específicas.</p>
`;

// ─────────────────────────────────────────────────────────────
// POST 5: Job Search in Latin America: How to Stand Out on LinkedIn
// Target: "buscar trabajo LinkedIn Latinoamérica", "LinkedIn LATAM"
// ─────────────────────────────────────────────────────────────

const post5En = `
<p><em>Last updated: March 2026</em></p>

<p>LinkedIn in Latin America is not the same game as LinkedIn in the US or Europe. The platform dynamics, recruiter behavior, networking culture, and the weight of personal connections are all different. If you're applying the generic "optimize your LinkedIn" advice from English-language career coaches, you're probably missing LATAM-specific opportunities.</p>

<p>This guide is written specifically for professionals in Argentina, Mexico, Colombia, Chile, Peru, Brazil (Portuguese speakers: adjust accordingly), and the rest of Latin America — whether you're job searching locally or targeting international remote roles.</p>

<h2>Why LinkedIn Matters Differently in LATAM</h2>
<p>In the US, LinkedIn is one of many sourcing channels recruiters use. In LATAM, for mid-to-senior professional roles, LinkedIn is often <em>the</em> primary channel. Many LATAM companies still rely heavily on referral networks and informal connections — which means your LinkedIn network quality matters as much as your profile content.</p>

<p>The LATAM LinkedIn landscape in 2026:</p>
<ul>
<li>Argentina, Colombia, Chile have the most active LinkedIn communities relative to working population</li>
<li>Mexico's tech and multinational ecosystem is heavily LinkedIn-dependent for talent acquisition</li>
<li>Brazil is growing fast — LinkedIn En Español doesn't apply here, but the principles do</li>
<li>Remote jobs from US/European companies are increasingly filled via LinkedIn sourcing in LATAM</li>
</ul>

<h2>The Bilingual Profile Advantage</h2>
<p>If you're targeting both local LATAM roles and international remote opportunities, a bilingual LinkedIn profile is your biggest lever. Here's how to do it effectively:</p>

<p><strong>Profile language:</strong> LinkedIn allows you to set a primary profile language. Set it to the language of your primary target audience. If you're targeting US remote roles primarily, set English as primary.</p>

<p><strong>The "other language" profile:</strong> LinkedIn has a feature to create profile translations — you can have a complete Spanish (or Portuguese) version of your profile that appears to viewers whose LinkedIn is set to that language. Use it. Most LATAM professionals don't, which means you immediately stand out to local recruiters while also being visible to international recruiters.</p>

<p><strong>Headline strategy for bilingual profiles:</strong> Your main headline should be in your primary language. Make it keyword-rich for your main target audience. The translated headline will automatically appear on your translated profile.</p>

<h2>LATAM-Specific LinkedIn Sections That Matter</h2>

<h3>Languages Section</h3>
<p>This is more important in LATAM than in the US. Explicitly list:</p>
<ul>
<li>Your native language</li>
<li>English with your honest proficiency level (Conversational / Professional / Native). Don't overstate — interviewers will find out.</li>
<li>Any other languages (Portuguese is a major advantage for LATAM professionals targeting Brazil or Portuguese companies)</li>
</ul>

<h3>Certifications and Courses</h3>
<p>In many LATAM markets, formal certifications carry more weight than in the US. Google, AWS, Coursera, and LinkedIn Learning certifications signal initiative and structured learning. Add them, especially if your degree is from a less internationally-recognized institution.</p>

<h3>Volunteer Work and Causes</h3>
<p>More so than in the US market, LATAM hiring culture often considers cultural fit and values alignment. Volunteer work and community involvement signal character and commitment — which matter in tight-knit professional networks.</p>

<h2>Networking Strategy for LATAM</h2>
<p>LATAM professional culture is relationship-first. Cold applications with zero prior contact convert at lower rates than in the US. Here's what works:</p>

<p><strong>The warm introduction path:</strong></p>
<ol>
<li>Identify second-degree connections at target companies</li>
<li>Ask a mutual connection for a warm intro — this is culturally expected and appreciated in LATAM</li>
<li>If no mutual connection exists, send a personalized connection request (never generic) with a specific reason: "I saw your post about [X] — I've worked in [related area] and would love to exchange ideas."</li>
</ol>

<p><strong>Engage publicly before reaching out privately:</strong> Comment thoughtfully on posts by people you want to connect with. Like and comment on content from target companies. Build familiarity before the DM.</p>

<p><strong>LinkedIn creator mode for visibility:</strong> Publishing content in Spanish (or Portuguese) on LinkedIn in LATAM is still low-competition. Professionals who publish even 1-2 posts per week about their area of expertise quickly become recognizable names in their niche.</p>

<h2>Targeting International Remote Roles from LATAM</h2>
<p>US and European companies increasingly hire LATAM talent for engineering, product, design, and marketing roles — often at near-US salaries. To be found by these recruiters:</p>

<ul>
<li><strong>Set your profile language to English.</strong> International recruiters search in English.</li>
<li><strong>Add "Open to Work" in the LinkedIn settings,</strong> including remote roles and your target countries (USA, Canada, UK, Germany, etc.).</li>
<li><strong>Your English About section matters.</strong> Write it as if you're talking to a US hiring manager — clear, direct, achievement-focused.</li>
<li><strong>Time zone signal:</strong> Mention in your headline or About section that you're in a LATAM time zone (often overlapping with US Eastern or Central) — this is a hidden advantage, not a disadvantage.</li>
<li><strong>Keywords that international companies search:</strong> "remote," "async," "distributed team," "timezone Americas" in your About section or skills.</li>
</ul>

<h2>Get Your Profile Audited for LATAM + International Visibility</h2>
<p><a href="/features">ProfileScore works in both English and Spanish</a> — analyze your LinkedIn profile in whichever language you operate in, get section-by-section scores, and receive AI rewrites tailored to your target market (local LATAM, US remote, or both). The <a href="/pricing">audit is free to start</a> and takes less than 2 minutes.</p>
`;

const post5Es = `
<p><em>Última actualización: marzo de 2026</em></p>

<p>LinkedIn en América Latina no es el mismo juego que en Estados Unidos o Europa. La dinámica de la plataforma, el comportamiento de los reclutadores, la cultura de networking y el peso de las conexiones personales son todos diferentes. Si estás aplicando los consejos genéricos de "optimizá tu LinkedIn" de coaches de carrera angloparlantes, probablemente estés perdiendo oportunidades específicas de LATAM.</p>

<p>Esta guía está escrita específicamente para profesionales en Argentina, México, Colombia, Chile, Perú, Brasil y el resto de América Latina — ya sea que estés buscando trabajo localmente o apuntando a roles remotos internacionales.</p>

<h2>Por qué LinkedIn importa diferente en LATAM</h2>
<p>En Estados Unidos, LinkedIn es uno de muchos canales que usan los reclutadores. En LATAM, para roles profesionales de nivel medio a senior, LinkedIn es a menudo <em>el</em> canal principal. Muchas empresas latinoamericanas todavía dependen en gran medida de redes de referidos y conexiones informales — lo que significa que la calidad de tu red de LinkedIn importa tanto como el contenido de tu perfil.</p>

<ul>
<li>Argentina, Colombia y Chile tienen las comunidades de LinkedIn más activas en relación a su población trabajadora</li>
<li>El ecosistema tech y multinacional de México depende heavily de LinkedIn para adquisición de talento</li>
<li>Los empleos remotos de empresas de EEUU/Europa se llenan cada vez más a través de LinkedIn en LATAM</li>
</ul>

<h2>La ventaja del perfil bilingüe</h2>
<p>Si buscás tanto roles locales en LATAM como oportunidades remotas internacionales, un perfil de LinkedIn bilingüe es tu mayor palanca.</p>

<p><strong>Idioma del perfil:</strong> LinkedIn te permite configurar un idioma de perfil principal. Configuralo en el idioma de tu audiencia objetivo principal. Si apuntás principalmente a roles remotos en EEUU, configurá inglés como principal.</p>

<p><strong>El perfil en "otro idioma":</strong> LinkedIn tiene una función para crear traducciones de perfil — podés tener una versión completa en español de tu perfil que aparece a los visitantes cuyo LinkedIn está configurado en ese idioma. Usala. La mayoría de los profesionales latinoamericanos no lo hace, lo que significa que inmediatamente te destacás ante los reclutadores locales mientras también sos visible para los reclutadores internacionales.</p>

<h2>Secciones de LinkedIn específicas de LATAM que importan</h2>

<h3>Sección de Idiomas</h3>
<p>Esto es más importante en LATAM que en EEUU. Lista explícitamente:</p>
<ul>
<li>Tu idioma nativo</li>
<li>Inglés con tu nivel de competencia honesto (Conversacional / Profesional / Nativo). No exageres — los entrevistadores lo descubrirán.</li>
<li>Cualquier otro idioma (el portugués es una gran ventaja para profesionales latinoamericanos que apuntan a Brasil o empresas portuguesas)</li>
</ul>

<h3>Certificaciones y Cursos</h3>
<p>En muchos mercados de LATAM, las certificaciones formales tienen más peso que en EEUU. Las certificaciones de Google, AWS, Coursera y LinkedIn Learning señalan iniciativa y aprendizaje estructurado. Agregarlas, especialmente si tu título es de una institución menos reconocida internacionalmente.</p>

<h2>Estrategia de networking para LATAM</h2>
<p>La cultura profesional latinoamericana es primero las relaciones. Las aplicaciones frías con cero contacto previo convierten a tasas más bajas que en EEUU.</p>

<p><strong>El camino de la introducción cálida:</strong></p>
<ol>
<li>Identificá conexiones de segundo grado en empresas objetivo</li>
<li>Pedí a una conexión mutua una presentación cálida — esto es culturalmente esperado y apreciado en LATAM</li>
<li>Si no existe una conexión mutua, enviá una solicitud de conexión personalizada (nunca genérica) con una razón específica</li>
</ol>

<p><strong>Modo creador de LinkedIn para visibilidad:</strong> Publicar contenido en español en LinkedIn en LATAM tiene poca competencia todavía. Los profesionales que publican incluso 1-2 posts por semana sobre su área de expertise rápidamente se vuelven nombres reconocibles en su nicho.</p>

<h2>Apuntar a roles remotos internacionales desde LATAM</h2>
<p>Las empresas de EEUU y Europa contratan cada vez más talento de LATAM para roles de ingeniería, producto, diseño y marketing — a menudo con salarios cercanos a los de EEUU.</p>

<ul>
<li><strong>Configurá el idioma de tu perfil en inglés.</strong> Los reclutadores internacionales buscan en inglés.</li>
<li><strong>Activá "Abierto a trabajar"</strong> incluyendo roles remotos y tus países objetivo.</li>
<li><strong>Señal de zona horaria:</strong> Mencioná en tu titular o sección Acerca de que estás en una zona horaria de LATAM (que a menudo se superpone con el Este o Centro de EEUU) — esto es una ventaja oculta.</li>
</ul>

<h2>Auditá tu perfil para visibilidad en LATAM + internacional</h2>
<p><a href="/features">ProfileScore funciona tanto en inglés como en español</a> — analizá tu perfil de LinkedIn en el idioma en que operás, obtené puntuaciones sección por sección y recibí reescrituras de IA adaptadas a tu mercado objetivo. <a href="/pricing">La auditoría es gratuita para comenzar</a> y tarda menos de 2 minutos.</p>
`;

// ─────────────────────────────────────────────────────────────
// POST 6: Free LinkedIn Profile Review: What to Look For
// Target: "LinkedIn profile review free", "LinkedIn audit tool"
// ─────────────────────────────────────────────────────────────

const post6En = `
<p><em>Last updated: March 2026</em></p>

<p>Before you send your next application or reach out to a recruiter, your LinkedIn profile should be able to stand on its own. This is a section-by-section self-review checklist you can complete in 30 minutes — identifying what's working, what's missing, and what's actively hurting your visibility.</p>

<p>If you'd rather skip the manual review and get an AI-powered score immediately, <a href="/features">ProfileScore analyzes every section in under 2 minutes</a>. But either way, understanding what great looks like helps you make better decisions about your profile.</p>

<h2>How to Conduct Your Own LinkedIn Profile Review</h2>

<h3>Step 1: View Your Profile as a Visitor</h3>
<p>Before auditing details, see your profile as others see it. Click "View Profile" then look at the top preview: What's your photo? What does your headline say? Does the above-the-fold experience make you want to learn more?</p>

<p>Ask yourself: If I had never met this person, would I send them a connection request? Would I message them? If the answer is uncertain, the fundamentals need work.</p>

<h3>Step 2: Photo and Background Banner</h3>
<p>Check these in order:</p>
<ul>
<li>☐ Is there a photo? (No photo = 21× fewer profile views)</li>
<li>☐ Is it recent and professional? (No selfies, group photos, or blurry images)</li>
<li>☐ Does your face fill 60-70% of the frame?</li>
<li>☐ Is the background neutral?</li>
<li>☐ Do you have a custom background banner? (Most profiles don't — easy way to stand out)</li>
</ul>

<h3>Step 3: Headline Review</h3>
<ul>
<li>☐ Is your headline more than just your job title?</li>
<li>☐ Does it include keywords a recruiter would search for your role?</li>
<li>☐ Does it include a value proposition — what you uniquely deliver?</li>
<li>☐ Is it at least 100 characters? (Most compelling headlines use 150-200 of the 220 allowed)</li>
<li>☐ Would someone reading it understand what you do without knowing your industry?</li>
</ul>
<p>If you answered "no" to 3 or more, your headline is a priority fix. See our <a href="/blog/linkedin-headline-examples-15-formulas-that-get-noticed">15 LinkedIn headline formulas guide</a> for rewrites.</p>

<h3>Step 4: About Section Review</h3>
<ul>
<li>☐ Is the About section filled out? (Blank About sections are a major missed opportunity)</li>
<li>☐ Do the first two lines create curiosity or just state your job title?</li>
<li>☐ Is it written in first person? (Not "John is a…")</li>
<li>☐ Does it include at least 2 quantified achievements?</li>
<li>☐ Does it end with a call to action or what you're looking for?</li>
<li>☐ Is it 3-5 paragraphs or less? (Long About sections lose readers)</li>
</ul>

<h3>Step 5: Experience Section Review</h3>
<p>For each role, check:</p>
<ul>
<li>☐ Is there a company name, job title, and date range?</li>
<li>☐ Does each role have at least 2 bullet points?</li>
<li>☐ Do bullets lead with strong action verbs (Led, Built, Grew, Reduced)?</li>
<li>☐ Does at least one bullet per role include a metric (%, $, time saved, users)?</li>
<li>☐ Are bullets about achievements, not just duties?</li>
<li>☐ Do older roles have fewer bullets than current/recent roles?</li>
</ul>
<p>The most common failure: bullets that describe job duties ("Managed social media accounts") rather than achievements ("Grew LinkedIn following from 500 to 15,000 in 6 months").</p>

<h3>Step 6: Skills Section Review</h3>
<ul>
<li>☐ Do you have at least 30 skills listed? (The maximum is 50 — most people leave 30+ slots empty)</li>
<li>☐ Are your most important and searchable skills in the top 3 positions?</li>
<li>☐ Do your skills match the language used in job descriptions for your target role?</li>
<li>☐ Do at least 5 skills have endorsements from connections?</li>
</ul>

<h3>Step 7: Education and Certifications</h3>
<ul>
<li>☐ Is your degree listed with institution, field, and graduation year?</li>
<li>☐ If you graduated in the last 5 years, did you add relevant coursework and honors?</li>
<li>☐ Are relevant professional certifications listed (AWS, Google, PMP, etc.)?</li>
<li>☐ If taking courses on LinkedIn Learning or Coursera, are recent completions listed?</li>
</ul>

<h3>Step 8: Profile Settings Review</h3>
<ul>
<li>☐ Have you set a custom LinkedIn URL? (linkedin.com/in/yourname, not linkedin.com/in/john-smith-49283bc)</li>
<li>☐ Is your profile set to public?</li>
<li>☐ Have you configured "Open to Work" if you're job seeking?</li>
<li>☐ Is your "Contact info" section filled with email or preferred contact method?</li>
</ul>

<h2>What Your Self-Review Score Means</h2>
<p>Count how many items above you checked "yes" to:</p>
<ul>
<li><strong>0-12:</strong> Your profile needs significant work. Focus on photo, headline, and at least 3 achievement bullets per role first.</li>
<li><strong>13-20:</strong> Solid foundation. Fix the items you missed — each one is measurably reducing your visibility or conversion rate.</li>
<li><strong>21-28:</strong> Strong profile. Focus on content strategy — start posting 1-2x per week to build authority in your area.</li>
<li><strong>28+:</strong> Excellent. Now optimize for specific roles by tailoring your headline and skills to active job descriptions.</li>
</ul>

<h2>Or Skip the Manual Review</h2>
<p>A self-review is a good start, but it's inherently subjective — you might miss things a fresh set of eyes (or an AI trained on millions of profiles) would catch immediately.</p>

<p><a href="/features">ProfileScore's AI audit</a> reviews every section of your LinkedIn profile against best practices, scores each area 0-100, identifies the specific gaps holding your score down, and suggests concrete rewrites. It's free to start, takes under 2 minutes, and gives you a prioritized action plan rather than a generic checklist.</p>

<p>The <a href="/pricing">paid upgrade ($5)</a> unlocks the AI-generated rewrites for every section — so instead of knowing what to fix, you have the fixed version ready to copy and paste.</p>
`;

const post6Es = `
<p><em>Última actualización: marzo de 2026</em></p>

<p>Antes de enviar tu próxima solicitud o contactar a un reclutador, tu perfil de LinkedIn debería poder sostenerse por sí solo. Esta es una checklist de revisión sección por sección que podés completar en 30 minutos.</p>

<p>Si preferís saltarte la revisión manual y obtener una puntuación impulsada por IA de inmediato, <a href="/features">ProfileScore analiza cada sección en menos de 2 minutos</a>.</p>

<h2>Cómo realizar tu propia revisión del perfil de LinkedIn</h2>

<h3>Paso 1: Ver tu perfil como visitante</h3>
<p>Antes de auditar detalles, veé tu perfil como lo ven los demás. Hacé clic en "Ver perfil" y observá la vista previa superior: ¿Cuál es tu foto? ¿Qué dice tu titular? ¿La experiencia "above the fold" te hace querer saber más?</p>

<h3>Paso 2: Foto e imagen de portada</h3>
<ul>
<li>☐ ¿Hay una foto? (Sin foto = 21× menos visitas al perfil)</li>
<li>☐ ¿Es reciente y profesional?</li>
<li>☐ ¿Tu cara ocupa el 60-70% del encuadre?</li>
<li>☐ ¿Tenés una imagen de portada personalizada?</li>
</ul>

<h3>Paso 3: Revisión del titular</h3>
<ul>
<li>☐ ¿Es tu titular más que solo tu título de trabajo?</li>
<li>☐ ¿Incluye palabras clave que un reclutador buscaría para tu rol?</li>
<li>☐ ¿Incluye una propuesta de valor?</li>
<li>☐ ¿Tiene al menos 100 caracteres?</li>
</ul>
<p>Si respondiste "no" a 3 o más, tu titular es una corrección prioritaria. Ver nuestra <a href="/blog/linkedin-headline-examples-15-formulas-that-get-noticed">guía de 15 fórmulas de titulares</a>.</p>

<h3>Paso 4: Revisión de la sección Acerca de</h3>
<ul>
<li>☐ ¿Está completada la sección Acerca de?</li>
<li>☐ ¿Las primeras dos líneas generan curiosidad?</li>
<li>☐ ¿Está escrita en primera persona?</li>
<li>☐ ¿Incluye al menos 2 logros cuantificados?</li>
<li>☐ ¿Termina con una llamada a la acción?</li>
</ul>

<h3>Paso 5: Revisión de la sección Experiencia</h3>
<p>Para cada rol, verificá:</p>
<ul>
<li>☐ ¿Hay nombre de empresa, título de trabajo y rango de fechas?</li>
<li>☐ ¿Cada rol tiene al menos 2 puntos?</li>
<li>☐ ¿Los puntos comienzan con verbos de acción fuertes (Lideré, Construí, Crecí, Reduje)?</li>
<li>☐ ¿Al menos un punto por rol incluye una métrica (%, $, tiempo ahorrado, usuarios)?</li>
<li>☐ ¿Los puntos son sobre logros, no solo responsabilidades?</li>
</ul>

<h3>Paso 6: Revisión de la sección Habilidades</h3>
<ul>
<li>☐ ¿Tenés al menos 30 habilidades listadas? (El máximo es 50)</li>
<li>☐ ¿Tus habilidades más importantes y buscables están en las primeras 3 posiciones?</li>
<li>☐ ¿Tus habilidades coinciden con el lenguaje usado en las descripciones de trabajo para tu rol objetivo?</li>
</ul>

<h2>Lo que significa tu puntuación de autoevaluación</h2>
<ul>
<li><strong>0-12:</strong> Tu perfil necesita trabajo significativo. Enfocate primero en foto, titular y al menos 3 puntos de logros por rol.</li>
<li><strong>13-20:</strong> Base sólida. Corregí los items que faltaron.</li>
<li><strong>21-28:</strong> Perfil fuerte. Enfocate en estrategia de contenido — comenzá a publicar 1-2 veces por semana.</li>
<li><strong>28+:</strong> Excelente. Ahora optimizá para roles específicos adaptando tu titular y habilidades a las descripciones de trabajo activas.</li>
</ul>

<h2>O saltate la revisión manual</h2>
<p>Una autoevaluación es un buen comienzo, pero es inherentemente subjetiva.</p>

<p><a href="/features">La auditoría de IA de ProfileScore</a> revisa cada sección de tu perfil de LinkedIn contra las mejores prácticas, puntúa cada área del 0 al 100, identifica las brechas específicas que reducen tu puntuación y sugiere reescrituras concretas. Es gratis para comenzar, tarda menos de 2 minutos y te da un plan de acción priorizado.</p>

<p>La <a href="/pricing">actualización paga</a> desbloquea las reescrituras generadas por IA para cada sección — en lugar de saber qué corregir, tenés la versión corregida lista para copiar y pegar.</p>
`;

// ─────────────────────────────────────────────────────────────
// Posts array
// ─────────────────────────────────────────────────────────────

const newPosts = [
  {
    slug: "how-to-improve-linkedin-profile-2026",
    title: "How to Improve Your LinkedIn Profile in 2026: Complete Guide",
    titleEs: "Cómo Mejorar Tu Perfil de LinkedIn en 2026: Guía Completa",
    description:
      "Step-by-step guide to optimizing every LinkedIn section: photo, headline, about, experience, and skills. Learn what recruiters look for and how AI can help.",
    descriptionEs:
      "Guía paso a paso para optimizar cada sección de LinkedIn: foto, titular, acerca de, experiencia y habilidades. Aprende qué buscan los reclutadores.",
    content: post1En.trim(),
    contentEs: post1Es.trim(),
    author: "Profile Score Team",
    tags: ["linkedin", "profile-optimization", "career", "job-search"],
    readingTimeMin: 10,
    published: true,
    publishedAt: new Date("2026-01-10"),
  },
  {
    slug: "linkedin-headline-examples-15-formulas-that-get-noticed",
    title: "LinkedIn Headline Examples: 15 Formulas That Get Noticed",
    titleEs: "Ejemplos de Titular de LinkedIn: 15 Fórmulas que Llaman la Atención",
    description:
      "15 proven LinkedIn headline formulas with before/after examples by profession. Stop using your job title — start getting found by recruiters.",
    descriptionEs:
      "15 fórmulas de titular de LinkedIn probadas con ejemplos antes/después por profesión. Dejá de usar solo tu título de trabajo — empezá a ser encontrado.",
    content: post2En.trim(),
    contentEs: post2Es.trim(),
    author: "Profile Score Team",
    tags: ["linkedin", "headline", "job-search", "profile-optimization"],
    readingTimeMin: 8,
    published: true,
    publishedAt: new Date("2026-01-20"),
  },
  {
    slug: "ats-friendly-resume-complete-guide-2026",
    title: "ATS-Friendly Resume: The Complete 2026 Guide",
    titleEs: "CV Compatible con ATS: La Guía Completa para 2026",
    description:
      "Learn exactly how ATS systems parse and score resumes. Formatting rules, keyword strategy, and the Wonsulting format that passes every ATS we've tested.",
    descriptionEs:
      "Aprende cómo los sistemas ATS analizan y puntúan CVs. Reglas de formato, estrategia de palabras clave y el formato que supera cada ATS que hemos probado.",
    content: post3En.trim(),
    contentEs: post3Es.trim(),
    author: "Profile Score Team",
    tags: ["ats", "resume", "cv", "career", "job-search"],
    readingTimeMin: 9,
    published: true,
    publishedAt: new Date("2026-02-01"),
  },
  {
    slug: "linkedin-about-section-how-to-write-summary-that-converts",
    title: "LinkedIn About Section: How to Write a Summary That Converts",
    titleEs: "Sección Acerca de LinkedIn: Cómo Escribir un Resumen que Convierte",
    description:
      "The 4-part framework for a LinkedIn About section that hooks recruiters in 2 lines and converts profile views into messages. Includes 3 full examples.",
    descriptionEs:
      "El framework de 4 partes para una sección Acerca de que engancha reclutadores en 2 líneas y convierte visitas en mensajes. Incluye 3 ejemplos completos.",
    content: post4En.trim(),
    contentEs: post4Es.trim(),
    author: "Profile Score Team",
    tags: ["linkedin", "about-section", "profile-optimization", "career"],
    readingTimeMin: 8,
    published: true,
    publishedAt: new Date("2026-02-10"),
  },
  {
    slug: "job-search-latin-america-stand-out-linkedin",
    title: "Job Search in Latin America: How to Stand Out on LinkedIn",
    titleEs: "Búsqueda de Empleo en Latinoamérica: Cómo Destacar en LinkedIn",
    description:
      "LATAM-specific LinkedIn strategies: bilingual profiles, warm networking culture, targeting international remote roles, and why LATAM LinkedIn is different.",
    descriptionEs:
      "Estrategias de LinkedIn específicas para LATAM: perfiles bilingües, cultura de networking, roles remotos internacionales y por qué LinkedIn en LATAM es diferente.",
    content: post5En.trim(),
    contentEs: post5Es.trim(),
    author: "Profile Score Team",
    tags: ["linkedin", "latam", "job-search", "remote-work", "career"],
    readingTimeMin: 9,
    published: true,
    publishedAt: new Date("2026-02-20"),
  },
  {
    slug: "free-linkedin-profile-review-what-to-look-for",
    title: "Free LinkedIn Profile Review: What to Look For (and How to Fix It)",
    titleEs: "Revisión Gratuita del Perfil de LinkedIn: Qué Buscar (y Cómo Corregirlo)",
    description:
      "A 30-minute self-review checklist for every LinkedIn section: photo, headline, about, experience, skills. Know exactly what's hurting your visibility.",
    descriptionEs:
      "Una checklist de autoevaluación de 30 minutos para cada sección de LinkedIn: foto, titular, acerca de, experiencia, habilidades. Sabé exactamente qué daña tu visibilidad.",
    content: post6En.trim(),
    contentEs: post6Es.trim(),
    author: "Profile Score Team",
    tags: ["linkedin", "profile-review", "job-search", "profile-optimization"],
    readingTimeMin: 7,
    published: true,
    publishedAt: new Date("2026-03-01"),
  },
];

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Phase 5.1 Step 3: Seed 6 New Blog Posts");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const post of newPosts) {
    const result = await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: post,
      create: post,
    });
    console.log(`✅ ${result.slug}`);
    console.log(`   EN: "${result.title}"`);
    console.log(`   ES: "${result.titleEs}"`);
    console.log(`   Tags: [${result.tags.join(", ")}]`);
    console.log(`   Published: ${result.publishedAt.toISOString().slice(0, 10)}`);
    console.log(`   Reading time: ${result.readingTimeMin} min\n`);
  }

  const total = await prisma.blogPost.count({ where: { published: true } });
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Total published blog posts: ${total}`);
  console.log(`═══════════════════════════════════════════════════════════`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  prisma.$disconnect();
  process.exit(1);
});
