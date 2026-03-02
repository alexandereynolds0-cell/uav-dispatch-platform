import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/trpc";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function SettingsPage() {
  const queryClient = useQueryClient();

  // 定价配置
  const { data: pricingConfig, isLoading: pricingLoading } = trpc.config.getPricingConfig.useQuery();
  
  const updatePricing = trpc.config.updatePricingConfig.useMutation({
    onSuccess: () => {
      toast.success("定价配置已更新");
      queryClient.invalidateQueries({ queryKey: ["config", "getPricingConfig"] });
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  // 排序配置
  const { data: sortConfig, isLoading: sortLoading } = trpc.config.getSortConfig.useQuery();
  
  const updateSort = trpc.config.updateSortConfig.useMutation({
    onSuccess: () => {
      toast.success("排序配置已更新");
      queryClient.invalidateQueries({ queryKey: ["config", "getSortConfig"] });
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  // 表单状态
  const [pricingForm, setPricingForm] = useState({
    baseServiceFee: 10,
    serviceFeeRate: 10,
    minServiceFee: 5,
    maxServiceFee: 100,
    sprayFee: 15,
    transportFee: 20,
  });

  const [sortForm, setSortForm] = useState({
    distanceWeight: 40,
    ratingWeight: 30,
    responseRateWeight: 15,
    activityWeight: 10,
    completionRateWeight: 5,
  });

  // 同步数据到表单
  if (pricingConfig && !pricingLoading) {
    setPricingForm({
      baseServiceFee: pricingConfig.baseServiceFee,
      serviceFeeRate: pricingConfig.serviceFeeRate * 100,
      minServiceFee: pricingConfig.minServiceFee,
      maxServiceFee: pricingConfig.maxServiceFee,
      sprayFee: pricingConfig.typeFees.spray,
      transportFee: pricingConfig.typeFees.transport,
    });
  }

  if (sortConfig && !sortLoading) {
    setSortForm({
      distanceWeight: sortConfig.distanceWeight * 100,
      ratingWeight: sortConfig.ratingWeight * 100,
      responseRateWeight: sortConfig.responseRateWeight * 100,
      activityWeight: sortConfig.activityWeight * 100,
      completionRateWeight: sortConfig.completionRateWeight * 100,
    });
  }

  const handlePricingSubmit = () => {
    updatePricing.mutate({
      baseServiceFee: pricingForm.baseServiceFee,
      serviceFeeRate: pricingForm.serviceFeeRate / 100,
      minServiceFee: pricingForm.minServiceFee,
      maxServiceFee: pricingForm.maxServiceFee,
      typeFees: {
        spray: pricingForm.sprayFee,
        transport: pricingForm.transportFee,
      },
    });
  };

  const handleSortSubmit = () => {
    const total = Object.values(sortForm).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 1) {
      toast.error(`权重总和必须为100%，当前为${total}%`);
      return;
    }

    updateSort.mutate({
      distanceWeight: sortForm.distanceWeight / 100,
      ratingWeight: sortForm.ratingWeight / 100,
      responseRateWeight: sortForm.responseRateWeight / 100,
      activityWeight: sortForm.activityWeight / 100,
      completionRateWeight: sortForm.completionRateWeight / 100,
    });
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">系统配置</h1>

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList>
          <TabsTrigger value="pricing">定价配置</TabsTrigger>
          <TabsTrigger value="sort">排序配置</TabsTrigger>
          <TabsTrigger value="contact">联系方式解锁</TabsTrigger>
        </TabsList>

        {/* 定价配置 */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>服务费定价配置</CardTitle>
              <CardDescription>
                配置平台服务费计算规则。用户发布任务时需要支付服务费。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>基础服务费 (元)</Label>
                  <Input
                    type="number"
                    value={pricingForm.baseServiceFee}
                    onChange={(e) => setPricingForm({ ...pricingForm, baseServiceFee: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>服务费比例 (%)</Label>
                  <Input
                    type="number"
                    value={pricingForm.serviceFeeRate}
                    onChange={(e) => setPricingForm({ ...pricingForm, serviceFeeRate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最低服务费 (元)</Label>
                  <Input
                    type="number"
                    value={pricingForm.minServiceFee}
                    onChange={(e) => setPricingForm({ ...pricingForm, minServiceFee: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最高服务费 (元)</Label>
                  <Input
                    type="number"
                    value={pricingForm.maxServiceFee}
                    onChange={(e) => setPricingForm({ ...pricingForm, maxServiceFee: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">任务类型服务费</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>植保任务服务费 (元)</Label>
                    <Input
                      type="number"
                      value={pricingForm.sprayFee}
                      onChange={(e) => setPricingForm({ ...pricingForm, sprayFee: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>运输任务服务费 (元)</Label>
                    <Input
                      type="number"
                      value={pricingForm.transportFee}
                      onChange={(e) => setPricingForm({ ...pricingForm, transportFee: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handlePricingSubmit} disabled={updatePricing.isPending}>
                {updatePricing.isPending ? "保存中..." : "保存配置"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 排序配置 */}
        <TabsContent value="sort">
          <Card>
            <CardHeader>
              <CardTitle>飞手排序权重配置</CardTitle>
              <CardDescription>
                配置飞手列表的排序权重。权重总和必须为100%。
                <br />
                当前总和: <span className={Object.values(sortForm).reduce((a, b) => a + b, 0) === 100 ? "text-green-600" : "text-red-600"}>
                  {Object.values(sortForm).reduce((a, b) => a + b, 0)}%
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>距离权重</Label>
                    <span className="text-sm text-gray-500">{sortForm.distanceWeight}%</span>
                  </div>
                  <Slider
                    value={[sortForm.distanceWeight]}
                    onValueChange={([value]) => setSortForm({ ...sortForm, distanceWeight: value })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>评分权重</Label>
                    <span className="text-sm text-gray-500">{sortForm.ratingWeight}%</span>
                  </div>
                  <Slider
                    value={[sortForm.ratingWeight]}
                    onValueChange={([value]) => setSortForm({ ...sortForm, ratingWeight: value })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>响应率权重</Label>
                    <span className="text-sm text-gray-500">{sortForm.responseRateWeight}%</span>
                  </div>
                  <Slider
                    value={[sortForm.responseRateWeight]}
                    onValueChange={([value]) => setSortForm({ ...sortForm, responseRateWeight: value })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>活跃度权重</Label>
                    <span className="text-sm text-gray-500">{sortForm.activityWeight}%</span>
                  </div>
                  <Slider
                    value={[sortForm.activityWeight]}
                    onValueChange={([value]) => setSortForm({ ...sortForm, activityWeight: value })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>完成率权重</Label>
                    <span className="text-sm text-gray-500">{sortForm.completionRateWeight}%</span>
                  </div>
                  <Slider
                    value={[sortForm.completionRateWeight]}
                    onValueChange={([value]) => setSortForm({ ...sortForm, completionRateWeight: value })}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              <Button onClick={handleSortSubmit} disabled={updateSort.isPending}>
                {updateSort.isPending ? "保存中..." : "保存配置"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 联系方式解锁配置 */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>联系方式解锁配置</CardTitle>
              <CardDescription>
                配置用户付费获取飞手联系方式的规则。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                用户需要支付一定费用才能查看飞手的联系方式（手机号、微信号）。
                支付后可与飞手进行私下沟通。
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">业务流程</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                  <li>用户浏览飞手列表</li>
                  <li>选择飞手并支付解锁费用</li>
                  <li>支付成功后获取飞手联系方式</li>
                  <li>可与飞手私下沟通并完成交易</li>
                  <li>平台收取信息费</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
