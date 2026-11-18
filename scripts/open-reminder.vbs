Function Q(s)
 Q = Chr(34) & Replace(s, Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
If WScript.Arguments.Count < 4 Then WScript.Quit 2
Set shell = CreateObject("WScript.Shell")
cmd = Q(WScript.Arguments(0)) & " " & Q(WScript.Arguments(1)) & " --data " & Q(WScript.Arguments(2)) & " --port " & Q(WScript.Arguments(3))
If WScript.Arguments.Count > 4 Then cmd = cmd & " --uri " & Q(WScript.Arguments(4))
shell.Run cmd, 0, False
