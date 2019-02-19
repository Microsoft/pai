/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License in the project root for license information.
 * @author Microsoft
 */

import { injectable } from 'inversify';
import * as vscode from 'vscode';

import {
    SETTING_JOB_JOBLIST_RECENTJOBSLENGTH, SETTING_SECTION_JOB
} from '../common/constants';
import { __ } from '../common/i18n';
import { getSingleton, Singleton } from '../common/singleton';

import { IPAICluster } from './paiInterface';

import { ClusterManager } from './clusterManager';
import { JobListTreeDataProvider } from './container/jobListTreeView';

/**
 * Manager class for cluster configurations
 */
@injectable()
export class RecentJobManager extends Singleton {
    private static readonly RECENT_JOBS_KEY: string = 'openpai.recentJobs';

    private onClusterModifyDisposable: vscode.Disposable | undefined;
    private recentJobs: (string[] | undefined)[] | undefined;

    public async onActivate(): Promise<void> {
        this.onClusterModifyDisposable = (await getSingleton(ClusterManager)).onDidModify(modification => {
            switch (modification.type) {
                case 'EDIT':
                    this.allRecentJobs[modification.index] = [];
                    break;
                case 'REMOVE':
                    this.allRecentJobs.splice(modification.index, 1);
                    break;
                case 'RESET':
                    this.recentJobs = [];
                    break;
                default:
            }
            void this.saveRecentJobs();
        });
        this.recentJobs = this.context.globalState.get<string[][]>(RecentJobManager.RECENT_JOBS_KEY) || [];
    }

    public get allRecentJobs(): (string[] | undefined)[] {
        return this.recentJobs!;
    }

    public async saveRecentJobs(index: number = -1): Promise<void> {
        await this.context.globalState.update(RecentJobManager.RECENT_JOBS_KEY, this.allRecentJobs);
        await (await getSingleton(JobListTreeDataProvider)).refresh(index);
    }

    public async enqueueRecentJobs(cluster: IPAICluster, jobName: string): Promise<void> {
        const index: number = (await getSingleton(ClusterManager)).allConfigurations.findIndex(c => c === cluster);
        if (index === -1) {
            return;
        }
        const list: string[] = this.allRecentJobs[index] = this.allRecentJobs[index] || [];
        list.unshift(jobName);
        const settings: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(SETTING_SECTION_JOB);
        const maxLen: number = settings.get(SETTING_JOB_JOBLIST_RECENTJOBSLENGTH) || 5;
        list.splice(maxLen); // Make sure not longer than maxLen
        await this.saveRecentJobs(index);
    }

    public onDeactivate(): void {
        if (this.onClusterModifyDisposable) {
            this.onClusterModifyDisposable.dispose();
        }
    }
}