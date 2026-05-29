class TaskParser {
    constructor() {
        this.tasks = [];
        this.currentTask = null;
        this.history = [];
    }

    parseLine(line) {
        const task = {
            timestamp: new Date(),
            line: line,
            type: this.detectTaskType(line),
            file: this.extractFilePath(line),
            command: this.extractCommand(line),
            duration: null
        };

        // 检查是否是任务开始
        if (this.isTaskStart(line)) {
            this.startTask(task);
        }
        // 检查是否是任务结束
        else if (this.isTaskEnd(line)) {
            this.endTask(task);
        }
        // 普通输出行
        else {
            this.addTaskOutput(task);
        }

        return task;
    }

    detectTaskType(line) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('file:') || lowerLine.includes('reading')) {
            return '📄读取文件';
        } else if (lowerLine.includes('edit') || lowerLine.includes('writing')) {
            return '✏️编辑文件';
        } else if (lowerLine.includes('save') || lowerLine.includes('saving')) {
            return '💾保存文件';
        } else if (lowerLine.includes('search') || lowerLine.includes('finding')) {
            return '🔍搜索代码';
        } else if (lowerLine.includes('run') || lowerLine.includes('executing')) {
            return '⚡执行命令';
        } else if (lowerLine.includes('done') || lowerLine.includes('completed')) {
            return '✅任务完成';
        } else if (lowerLine.includes('error') || lowerLine.includes('failed')) {
            return '❌错误';
        } else {
            return '📝信息';
        }
    }

    extractFilePath(line) {
        // 匹配常见的文件路径模式
        const patterns = [
            /File:\s*(.+?)(?:\s|$)/i,
            /Editing:\s*(.+?)(?:\s|$)/i,
            /Reading:\s*(.+?)(?:\s|$)/i,
            /Saving:\s*(.+?)(?:\s|$)/i,
            /(\/[^\s]+\.(?:js|ts|py|java|cpp|cs|go|rs|php|rb|html|css|json|xml|yml|yaml|md|txt))/,
            /([A-Za-z]:\\[^\s]+\.(?:js|ts|py|java|cpp|cs|go|rs|php|rb|html|css|json|xml|yml|yaml|md|txt))/,
            /(\w+\.(?:js|ts|py|java|cpp|cs|go|rs|php|rb|html|css|json|xml|yml|yaml|md|txt))/
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    extractCommand(line) {
        // 匹配常见的命令模式
        const patterns = [
            /Running:\s*(.+?)(?:\s|$)/i,
            /Command:\s*(.+?)(?:\s|$)/i,
            /Executing:\s*(.+?)(?:\s|$)/i,
            /`(.+?)`/,
            /npm\s+(?:run\s+)?(\w+)/,
            /yarn\s+(\w+)/,
            /python3?\s+(.+?)(?:\s|$)/,
            /node\s+(.+?)(?:\s|$)/,
            /git\s+(\w+)/,
            /docker\s+(\w+)/
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    isTaskStart(line) {
        const lowerLine = line.toLowerCase();
        return (
            lowerLine.includes('starting') ||
            lowerLine.includes('beginning') ||
            lowerLine.includes('running:') ||
            lowerLine.includes('executing:') ||
            lowerLine.includes('file:') ||
            lowerLine.includes('editing:') ||
            lowerLine.includes('reading:')
        );
    }

    isTaskEnd(line) {
        const lowerLine = line.toLowerCase();
        return (
            lowerLine.includes('done') ||
            lowerLine.includes('completed') ||
            lowerLine.includes('finished') ||
            lowerLine.includes('saved') ||
            lowerLine.includes('saved:') ||
            lowerLine.includes('error') ||
            lowerLine.includes('failed')
        );
    }

    startTask(task) {
        this.currentTask = {
            ...task,
            startTime: new Date(),
            outputs: [task.line]
        };
        this.tasks.push(this.currentTask);
    }

    endTask(task) {
        if (!this.currentTask) return;

        this.currentTask.endTime = new Date();
        this.currentTask.duration = this.currentTask.endTime - this.currentTask.startTime;
        this.currentTask.outputs.push(task.line);
        
        // 添加到历史记录
        this.history.push({
            ...this.currentTask,
            id: Date.now().toString()
        });

        this.currentTask = null;
    }

    addTaskOutput(task) {
        if (this.currentTask) {
            this.currentTask.outputs.push(task.line);
        } else {
            // 如果没有当前任务，创建一个新的信息任务
            const infoTask = {
                ...task,
                startTime: new Date(),
                endTime: new Date(),
                duration: 0,
                outputs: [task.line]
            };
            this.tasks.push(infoTask);
            this.history.push({
                ...infoTask,
                id: Date.now().toString()
            });
        }
    }

    getCurrentTask() {
        return this.currentTask;
    }

    getTaskHistory() {
        return this.history;
    }

    getTasksByType(type) {
        return this.history.filter(task => task.type === type);
    }

    getTasksByFile(filePath) {
        return this.history.filter(task => task.file === filePath);
    }

    clearHistory() {
        this.tasks = [];
        this.history = [];
        this.currentTask = null;
    }

    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(2)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(0);
            return `${minutes}m ${seconds}s`;
        }
    }

    formatTaskForDisplay(task) {
        const time = task.timestamp.toLocaleTimeString();
        const duration = task.duration ? ` (${this.formatDuration(task.duration)})` : '';
        
        let display = `[${time}] ${task.type}`;
        
        if (task.file) {
            display += `: ${task.file}`;
        } else if (task.command) {
            display += `: ${task.command}`;
        }
        
        display += duration;
        
        return display;
    }

    parseOutput(output) {
        const lines = output.split('\n');
        const tasks = [];
        
        lines.forEach(line => {
            if (line.trim()) {
                const task = this.parseLine(line);
                tasks.push(task);
            }
        });
        
        return tasks;
    }

    // 解析 ANSI 颜色码
    stripAnsiCodes(text) {
        // 移除 ANSI 颜色码
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    // 获取任务统计
    getStatistics() {
        const stats = {
            totalTasks: this.history.length,
            byType: {},
            totalDuration: 0,
            filesModified: new Set(),
            commandsExecuted: new Set()
        };

        this.history.forEach(task => {
            // 按类型统计
            stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
            
            // 总时长
            if (task.duration) {
                stats.totalDuration += task.duration;
            }
            
            // 文件修改
            if (task.file) {
                stats.filesModified.add(task.file);
            }
            
            // 命令执行
            if (task.command) {
                stats.commandsExecuted.add(task.command);
            }
        });

        stats.filesModifiedCount = stats.filesModified.size;
        stats.commandsExecutedCount = stats.commandsExecuted.size;

        return stats;
    }
}

// 导出为模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskParser;
} else {
    window.TaskParser = TaskParser;
}