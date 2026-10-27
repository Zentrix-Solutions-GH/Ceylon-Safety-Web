---
name: brainstorm
description: "Use this before building any new feature, page, API, or flow — draw out what is actually wanted and why, produce a design doc in docs/superpowers/specs/, and get approval before any code is written."
---

# Brainstorming — CeylonSafety

You are very good at building. You build what you believe your human
partner wants, and that belief is usually thinner than it feels. This
skill is for finding out what they actually want, and why, before
anything gets built.

People often haven't finished working out what they want. Good questions
help them think it through. When you understand the why, you make the
hundred decisions they never mention the way they would have made them.

## First: What Do You Actually Know?

Before you reply, ask yourself: what do I know about what they want, and
why?

- **Everything that matters is in the request** ("make the icon cornflower
  blue"). This is a quick, clear task. Do it, and say what you did.
- **Something non-trivial is missing.** Start the conversation.

Before you start implementing, you must, in order:

1. Lay out the approaches in a message of their own, and have your
   human partner pick one (see Lay out the approaches).
2. Write the design doc, short or full (see Size the Work).
3. Get their approval of that doc.
4. Invoke `/story-new` to create the story from the approved design.

Two things aren't implementing: a spike they said yes to (see Spike to
feel things out), and doing what they asked once they've opted out of
the questions.

## Look Before You Ask

Read `CLAUDE.md` and any referenced design docs in `docs/superpowers/specs/`
before your first message. Keep reading until you can explain how the
relevant parts of CeylonSafety work today and what this change would touch.
Never ask what the project or their context already answers.

## Your First Message

Move the work forward, with one of these:

- **They've already said what they want** (a spec, a plan, a detailed
  request): aim for about 200 words for the whole message. Echo their
  request back in your own words, so they can see whether you've got its
  shape: what they want, who it's for, and why, as far as they've said.
  Add what you found that bears on it: how the relevant parts work today
  and what the change would touch. If you found something they may not
  have considered that would change what they're asking for or how it
  has to be built, like a constraint, a conflict, or a cheaper path, say
  so plainly. How to build it comes later, once you understand what they
  want (see Lay out the approaches). End with one line inviting
  corrections, then one question about what they want: the thing their
  request leaves open whose answer would most change what gets built.
  Specs are often incomplete, so confirm before you build on one.
- **They haven't:** one open question, in their own terms, about the
  biggest thing their request leaves unsettled. Say why you're asking:
  what the answer would change about what you build.

How the message ends depends on whether their message asked for
brainstorming:

- **They asked for it**: end with your question.
- **They didn't**: after your question, add a light, one-line offer to
  just get going instead, like "Or if you'd rather I just dive in, say
  so." If they take you up on it, this skill is done.

That's the whole message.

## The Conversation

Each message ends with one question: a single sentence with no list of
example answers hanging off it. Use plain language. Match their vocabulary;
never use process jargon.

**Get them describing.** Open questions come first. Their own words carry
intent that your options can't. Offer a short menu only when they're stuck.
When they say "just guess" or "what do you think?", propose something concrete.

**How it gets made.** Find out early which choices they want to make, which
they're handing to you, and what they already have to work with. CeylonSafety
uses Next.js App Router, Supabase, Cloudflare R2, Resend, PayHere, Tailwind,
and shadcn/ui — build on what's already there.

**Ground to cover.** This is territory, not a script:

- what kind of thing this is, and what makes it special
- why now, and what success looks like to them
- goals, non-goals, and anti-goals (what would make this a failure even
  if it technically works)
- prior art: existing design docs in `docs/superpowers/specs/` that overlap
- current state: what exists now, what they've tried
- which role owns this work (`frontend` or `backend`, per CLAUDE.md)
- the details they care about

**Make every question specific** to what they've told you. Build each
question on their last answer or on something you found.

**Lay out the approaches.** Once you understand what they want, and before
you write anything up, put the ways of building it in a message of its own.
Present two or three real alternatives, grounding each in the project stack
and saying what it trades off. Recommend one and say why, then ask which
way they want to go.

**Spike to feel things out.** A quick throwaway build is often the cheapest
way to learn what they want or whether something works. Offer one when it
would help. Spikes get no tests or minimal ones and skip the plan, implementation,
and review process.

## Play It Back

Play back as you go. As soon as you understand one part well enough to
describe it, describe that part back in about 200–300 words, then return to
questions about the next part. Only what they said goes in as theirs. Anything
you filled in goes in as your proposal, with your reason. End each chunk by
asking what's wrong or missing.

## Size the Work

Once you understand what they want and they've picked an approach, say how
big the work is in plain words.

| Size | The design doc |
|------|----------------|
| A small change | a short one: what you already covered together, written down |
| A project | the full written design (below) |

Short or full, the design doc has an **Approaches** part: the two or three
ways you considered building it, what each trades off, which one they picked,
and why.

If it grows mid-task, stop, say so, and step up a size.

If this is really several independent projects, say so, agree on an order,
and brainstorm them one at a time.

## The Written Design

Write a plain document a talented builder could plan from without going back
to your human partner. Cover:

- intent and the why
- goals, non-goals, anti-goals
- constraints (OPEN items to flag, security rules, role ownership)
- approaches
- the parts of the how they decided, as they decided them
- what's left to the builder

**Where it goes:** `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`,
committed to the branch. Use today's date.

**Requirement status:** mark each requirement as CONFIRMED, ASSUMED, or OPEN,
following the conventions in `docs/superpowers/specs/2026-10-13-ceylonsafety-requirements.md`.
Any OPEN item must be resolved before the design is approved.

<HARD-GATE>
Nothing gets built until your human partner approves the design doc.
Building includes writing product code, scaffolding, installing
dependencies, creating stories, and invoking /story-new.
Reading and exploring are fine.

Two exceptions. If they opted out of the questions, the skill is done
and the gate goes with it. A spike they said yes to may be built; it
stays labeled throwaway.

After the design doc is approved, invoke /story-new — not code.
</HARD-GATE>

## Red Flags

| Thought | Reality |
|---------|---------|
| "I'll offer a menu of what they might want" | Options steer. Ask them to describe it first. |
| "I'll fill in sensible defaults" | Good. Say them out loud. A default they never heard is one they couldn't reject. |
| "I've answered their questions, so I'll write the doc" | Lay out the approaches first, in a message of their own. |
| "I should explain the process first" | Ask your question. The process shows itself. |
| "They said 'sounds good' to the idea" | Approval covers what you showed them. A design doc you haven't written isn't approved. |
| "The spike works, I'll keep building on it" | Keeping it is a new request. Back through the gate. |
