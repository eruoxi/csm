/**
 * CSM 状态管理模块
 */

import { ensureDir, pathExists, readJson, remove } from 'fs-extra';
import { getCsmDir, getStatePath } from '../utils/file';
import { writeJsonAtomic } from '../utils/atomicWrite';
import type { CsmState } from '../types';

// 默认状态
const DEFAULT_STATE: CsmState = {
    activeProfile: null,
    version: '1.0.0'
};

/**
 * 状态文件读取结果
 */
interface StateReadResult {
    state: CsmState;
    isCorrupted: boolean;
    corruptionError?: string;
}

/**
 * CSM 状态管理器
 */
export class StateManager {
    private csmDir: string;
    private stateFile: string;

    constructor() {
        this.csmDir = getCsmDir();
        this.stateFile = getStatePath();
    }

    /**
     * 读取状态
     * @returns 状态读取结果，包含是否损坏的信息
     */
    async read(): Promise<CsmState> {
        const result = await this.readWithStatus();
        return result.state;
    }

    /**
     * 读取状态并返回详细信息
     */
    async readWithStatus(): Promise<StateReadResult> {
        try {
            const exists = await pathExists(this.stateFile);
            if (!exists) {
                return { state: {...DEFAULT_STATE}, isCorrupted: false };
            }

            const content = await readJson(this.stateFile);

            // 验证状态格式
            if (typeof content !== 'object' || content === null) {
                return {
                    state: {...DEFAULT_STATE},
                    isCorrupted: true,
                    corruptionError: '状态文件内容不是有效对象'
                };
            }

            // 检查必要字段
            const state = { ...DEFAULT_STATE, ...content };

            // 验证 activeProfile 字段
            if (state.activeProfile !== null && typeof state.activeProfile !== 'string') {
                return {
                    state: {...DEFAULT_STATE},
                    isCorrupted: true,
                    corruptionError: 'activeProfile 字段类型无效'
                };
            }

            return { state, isCorrupted: false };
        } catch (error) {
            // 区分错误类型
            const errorMessage = error instanceof Error ? error.message : String(error);
            const nodeError = error as NodeJS.ErrnoException;

            // 权限错误 - 使用 error.code 检测
            if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
                console.warn(`警告: 无法读取状态文件 (权限问题): ${errorMessage}`);
                return {
                    state: {...DEFAULT_STATE},
                    isCorrupted: true,
                    corruptionError: '权限不足，无法读取状态文件'
                };
            }

            // JSON 解析错误 - 检查是否为 SyntaxError
            if (error instanceof SyntaxError) {
                console.warn(`警告: 状态文件已损坏，将使用默认状态: ${errorMessage}`);
                return {
                    state: {...DEFAULT_STATE},
                    isCorrupted: true,
                    corruptionError: '状态文件格式损坏'
                };
            }

            // 其他错误
            return {
                state: {...DEFAULT_STATE},
                isCorrupted: true,
                corruptionError: errorMessage
            };
        }
    }

    /**
     * 检查状态文件是否损坏
     */
    async isStateCorrupted(): Promise<{ corrupted: boolean; error?: string }> {
        const result = await this.readWithStatus();
        if (result.isCorrupted) {
            return { corrupted: true, error: result.corruptionError };
        }
        return { corrupted: false };
    }

    /**
     * 重置损坏的状态文件
     */
    async resetCorruptedState(): Promise<boolean> {
        const { isCorrupted } = await this.readWithStatus();
        if (isCorrupted) {
            try {
                await remove(this.stateFile);
                console.log('已重置损坏的状态文件');
                return true;
            } catch (error) {
                console.error(`无法删除损坏的状态文件: ${error instanceof Error ? error.message : String(error)}`);
                return false;
            }
        }
        return false;
    }

    /**
     * 写入状态（使用原子写入）
     */
    async write(state: CsmState): Promise<void> {
        await ensureDir(this.csmDir);
        await writeJsonAtomic(this.stateFile, state, { spaces: 2 });
    }

    /**
     * 设置当前激活的 Profile
     */
    async setActiveProfile(name: string | null): Promise<void> {
        const state = await this.read();
        state.activeProfile = name;
        await this.write(state);
    }

    /**
     * 获取当前激活的 Profile
     */
    async getActiveProfile(): Promise<string | null> {
        const state = await this.read();
        return state.activeProfile;
    }
}

// 导出默认实例
export const stateManager = new StateManager();
