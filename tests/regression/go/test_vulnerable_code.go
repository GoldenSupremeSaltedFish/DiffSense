package main

import (
	"fmt"
	"net/http"
	"os/exec"
)

// 模拟CVE-2022-31259 - Command injection vulnerability
func vulnerableFunction1(userInput string) {
	// 危险：直接使用用户输入执行系统命令
	cmd := exec.Command("echo", userInput)
	output, _ := cmd.Output()
	fmt.Println(string(output))
}

// 模拟其他漏洞模式
func vulnerableFunction2(url string) {
	// SSRF漏洞模式
	resp, _ := http.Get(url)
	defer resp.Body.Close()
}

func safeFunction() {
	// 安全的代码示例
	fmt.Println("Hello, World!")
}