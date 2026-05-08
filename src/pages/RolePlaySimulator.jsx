// This file is intentionally left blank. The old RolePlaySimulator page is permanently disabled. Do not import or route to this file.
export default function DisabledRolePlaySimulator() {
  return null;
}
          style={{
            background: "linear-gradient(135deg, hsl(222, 52%, 17%) 0%, hsl(174, 28%, 16%) 60%, hsl(174, 35%, 19%) 100%)",
            border: "1px solid hsl(174 60% 52% / 0.3)"
          }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-7 py-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "hsl(174 30% 18%)", border: "1px solid hsl(174 60% 52% / 0.4)" }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41m12.02 0l-1.41-1.41M6.34 6.34L4.93 4.93" stroke="#4fd1c5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "hsl(174 60% 65%)" }}>Signal Intelligence™ Practice</p>
                <h1 className="text-2xl font-bold text-foreground leading-tight">Role Play Simulator Gateway</h1>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-lg leading-relaxed">
                  Experience the industry-standard, AI-powered HCP interaction lab. Practice, calibrate, and master real-world conversations in a safe, enterprise-grade environment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Instructional Video */}
        <div className="mb-8">
          <div className="aspect-w-16 aspect-h-9 rounded-xl overflow-hidden shadow-lg border border-blue-900 mx-auto max-w-xl">
            <iframe
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Role Play Simulator Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
          <p className="text-xs text-blue-200 mt-2">Watch this quick walkthrough to see how the simulator works!</p>
        </div>

        {/* Interactive Onboarding Animation */}
        <div className="bg-slate-800/80 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-semibold mb-4 text-teal-300">How It Works</h2>
          <div className="flex flex-col items-center">
            <div className="w-full flex flex-col items-center">
              <div className="relative w-64 h-40 mb-4">
                <img src={demoSteps[step].img} alt={demoSteps[step].label} className="w-64 h-40 object-cover rounded-xl shadow border border-blue-900" />
                {/* Animated click highlight */}
                {step === 0 && <div className="absolute left-8 top-8 animate-pulse bg-teal-400/80 rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-4 border-white/60" style={{ zIndex: 2 }}><span className="font-bold text-slate-900">1</span></div>}
                {step === 1 && <div className="absolute right-8 bottom-8 animate-pulse bg-blue-400/80 rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-4 border-white/60" style={{ zIndex: 2 }}><span className="font-bold text-slate-900">2</span></div>}
                {step === 2 && <div className="absolute left-1/2 top-1/2 animate-pulse bg-yellow-400/80 rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-4 border-white/60" style={{ zIndex: 2, transform: 'translate(-50%, -50%)' }}><span className="font-bold text-slate-900">3</span></div>}
                {step === 3 && <div className="absolute right-8 top-8 animate-pulse bg-pink-400/80 rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-4 border-white/60" style={{ zIndex: 2 }}><span className="font-bold text-slate-900">4</span></div>}
              </div>
              <div className="text-lg font-bold mb-1 text-teal-200">{demoSteps[step].label}</div>
              <div className="text-base text-blue-100 mb-2">{demoSteps[step].text}</div>
            </div>
            <div className="flex gap-2 mt-2">
              {demoSteps.map((_, i) => (
                <button
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 ${i === step ? 'bg-teal-400 border-teal-300' : 'bg-slate-700 border-slate-500'}`}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Key Features */}
        <ul className="text-left text-base md:text-lg mx-auto max-w-md space-y-2 list-disc list-inside text-blue-200">
          <li>Onboarding & scenario walkthroughs for new users</li>
          <li>Live behavioral feedback and coaching</li>
          <li>Enterprise privacy and data protection</li>
          <li>Powered by a dedicated, isolated AI worker</li>
        </ul>

        {/* CTA */}
        <div className="my-8">
          <a
            href="https://rps.reflectiv-ai.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-teal-400 to-blue-300 text-slate-900 font-bold text-xl shadow-lg hover:bg-teal-300 transition"
          >
            🚀 Take the RPS for a Spin
          </a>
        </div>
        <div className="text-xs text-blue-300 mt-6">
          <span>All role play sessions are powered by a dedicated, secure backend. No data is shared with the main site or any third party.</span>
        </div>
      </div>
    </div>
  );
}
