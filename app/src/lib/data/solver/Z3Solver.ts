import type { HardConstraint, SoftConstraint, SolverResult, ConstraintVariable } from './ConstraintSolver';
import { ConstraintSolver } from './ConstraintSolver';
import { init } from 'z3-solver';
import type { Context } from 'z3-solver';

type Z3Api = Awaited<ReturnType<typeof init>>;
let z3Promise: Promise<Z3Api> | null = null;
let initZ3Promise: Promise<void> | null = null;

async function ensureBrowserInitZ3Loaded() {
	if (typeof window === 'undefined') return;

	const root = globalThis as unknown as { initZ3?: unknown };
	if (root.initZ3) return;

	if (!initZ3Promise) {
		initZ3Promise = import('z3-solver/build/z3-built.js').then((module) => {
			const initZ3 = (module as unknown as { default?: unknown }).default;
			if (typeof initZ3 !== 'function') {
				throw new Error('Z3 initZ3 模块加载失败（未找到默认导出）');
			}
			(root as { initZ3?: unknown }).initZ3 = initZ3;
		});
	}

	await initZ3Promise;
}

export class Z3Solver extends ConstraintSolver {
	private api: Z3Api | null = null;
	private ctx: Context<'main'> | null = null;

	async init() {
		if (this.ctx) return;
		if (!z3Promise) {
			await ensureBrowserInitZ3Loaded();
			z3Promise = init();
		}
		this.api = await z3Promise;
		this.ctx = this.api.Context('main');
	}

	async solve(config: {
		variables: ConstraintVariable[];
		hard: HardConstraint[];
		soft?: SoftConstraint[];
	}): Promise<SolverResult> {
		if (!this.ctx) throw new Error('Z3Solver 尚未初始化');

		const optimize = new this.ctx.Optimize();
		const varMap = new Map<string, ReturnType<typeof this.ctx.Bool.const>>();
		const getVar = (id: string) => {
			let entry = varMap.get(id);
			if (!entry) {
				entry = this.ctx!.Bool.const(id);
				varMap.set(id, entry);
			}
			return entry;
		};

		config.variables.forEach((variable) => getVar(variable.id));

		config.hard.forEach((constraint) => {
			switch (constraint.type) {
				case 'require':
					optimize.add(constraint.value ? getVar(constraint.variable) : getVar(constraint.variable).not());
					break;
				case 'atLeastOne':
					optimize.add(this.ctx!.Or(...constraint.variables.map((id) => getVar(id))));
					break;
				case 'mutex':
					const pairs = pairwise(constraint.variables);
					pairs.forEach(([a, b]) => {
						optimize.add(this.ctx!.Or(getVar(a).not(), getVar(b).not()));
					});
					break;
				case 'custom':
					// custom expressions暂未实现
					break;
			}
		});

		config.soft?.forEach((constraint) => {
			const literal =
				constraint.prefer === false
					? this.ctx!.Not(this.ctx!.Or(...constraint.variables.map((id) => getVar(id))))
					: this.ctx!.Or(...constraint.variables.map((id) => getVar(id)));
			optimize.addSoft(literal, constraint.weight, constraint.id);
		});

		const result = await optimize.check();
		const satisfiable = result === 'sat';
		if (!satisfiable) {
			return { satisfiable: false, unsatCore: [] };
		}

		const model = optimize.model();
		const assignment: Record<string, boolean> = {};
		for (const [id, variable] of varMap.entries()) {
			const evaluated = model.eval(variable, true);
			assignment[id] = this.ctx.isTrue(evaluated);
		}

		return {
			satisfiable: true,
			assignment
		};
	}

	async dispose() {
		// no-op for now
	}
}

function pairwise<T>(items: T[]): [T, T][] {
	const pairs: [T, T][] = [];
	for (let i = 0; i < items.length; i += 1) {
		for (let j = i + 1; j < items.length; j += 1) {
			pairs.push([items[i], items[j]]);
		}
	}
	return pairs;
}
